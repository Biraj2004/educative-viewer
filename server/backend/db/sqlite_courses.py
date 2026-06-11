from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass
from typing import Sequence

log = logging.getLogger(__name__)

OFFSET_STEP = 10000


@dataclass(frozen=True)
class CourseDbShard:
    index: int
    db_path: str
    offset: int


import zlib
import os
import shutil
import threading

_CACHE_LOCK = threading.Lock()

class SQLiteCourseDatabase:
    """SQLite adapter for course/topic read APIs.

    Supports a multi-DB setup where each DB is assigned a stable offset
    based on a CRC32 hash of its filename. Includes optional dynamic local
    caching for high-performance reading on network mounts.
    """

    engine = "sqlite"

    def __init__(self, db_paths: Sequence[str], connection_mode: str = "ro", offset_step: int = OFFSET_STEP):
        if offset_step <= 0:
            raise ValueError("offset_step must be positive")
        if not db_paths:
            raise ValueError("At least one course DB path must be configured")

        self.offset_step = offset_step
        self.connection_mode = connection_mode
        
        # Configure dynamic local caching if COURSE_DB_CACHE_DIR is set
        self.cache_dir = os.environ.get("COURSE_DB_CACHE_DIR", "").strip()
        if self.cache_dir:
            self.cache_dir = os.path.abspath(self.cache_dir)
            os.makedirs(self.cache_dir, exist_ok=True)
            try:
                raw_size = os.environ.get("COURSE_DB_CACHE_SIZE_GB", "10")
                self.max_cache_bytes = int(float(raw_size) * 1024 * 1024 * 1024)
            except ValueError:
                self.max_cache_bytes = 10 * 1024 * 1024 * 1024
            log.info(f"Local course DB cache enabled at '{self.cache_dir}' with limit {self.max_cache_bytes / (1024**3):.1f} GB")
        else:
            self.cache_dir = None
            self.max_cache_bytes = 0

        # Configure centralized catalog database if COURSE_DB_METADATA_PATH is set
        metadata_path = os.environ.get("COURSE_DB_METADATA_PATH", "").strip()
        if metadata_path:
            metadata_path = os.path.abspath(metadata_path)
            self.metadata_shard = CourseDbShard(index=-1, db_path=metadata_path, offset=0)
            log.info(f"Centralized Course DB catalog enabled using: {metadata_path}")
        else:
            self.metadata_shard = None
        
        shards_list = []
        self._offset_to_shard = {}
        
        for index, path in enumerate(db_paths):
            basename = os.path.basename(path)
            # Generate a deterministic 32-bit integer from the filename
            crc = zlib.crc32(basename.encode('utf-8')) & 0xffffffff
            
            # Handle extremely rare CRC collisions by incrementing
            while (crc * offset_step) in self._offset_to_shard:
                crc += 1
                
            offset = crc * offset_step
            shard = CourseDbShard(index=index, db_path=path, offset=offset)
            shards_list.append(shard)
            self._offset_to_shard[offset] = shard
            
        self.shards = tuple(shards_list)
        self._table_columns_cache: dict[tuple[str, str], set[str]] = {}

        if len(self.shards) > 1:
            entries = ", ".join(
                f"{os.path.basename(shard.db_path)} (offset {shard.offset})" for shard in self.shards
            )
            log.info("Course DB multi-db enabled with stable CRC32 offsets.")
        else:
            log.info("Course DB single-db mode: %s", self.shards[0].db_path)

    def _get_local_db_path(self, remote_path: str) -> str:
        """Downloads/caches the database locally on demand, maintaining an LRU policy."""
        if not self.cache_dir or not os.path.exists(remote_path):
            return remote_path

        db_name = os.path.basename(remote_path)
        local_path = os.path.join(self.cache_dir, db_name)

        with _CACHE_LOCK:
            try:
                remote_stat = os.stat(remote_path)
                remote_size = remote_stat.st_size
            except OSError as e:
                log.warning(f"Could not stat remote file {remote_path}: {e}")
                return remote_path

            copy_needed = True
            if os.path.exists(local_path):
                try:
                    local_stat = os.stat(local_path)
                    if local_stat.st_size == remote_size:
                        copy_needed = False
                        # Update access time to indicate recent access for LRU
                        os.utime(local_path, None)
                except OSError:
                    pass

            if copy_needed:
                log.info(f"Caching course DB from remote mount: {remote_path} -> {local_path}")
                self._trim_cache(remote_size)
                
                temp_path = local_path + ".tmp"
                try:
                    shutil.copy2(remote_path, temp_path)
                    os.replace(temp_path, local_path)
                except Exception as e:
                    log.error(f"Failed to cache database {remote_path} to local: {e}")
                    if os.path.exists(temp_path):
                        try:
                            os.remove(temp_path)
                        except OSError:
                            pass
                    return remote_path

        return local_path

    def _trim_cache(self, incoming_bytes: int) -> None:
        """Trim the oldest accessed files in the cache to stay below max size."""
        if not self.cache_dir or self.max_cache_bytes <= 0:
            return

        cached_files = []
        total_size = 0
        try:
            for entry in os.scandir(self.cache_dir):
                if entry.is_file() and entry.name.lower().endswith((".db", ".sqlite", ".sqlite3")):
                    stat = entry.stat()
                    cached_files.append((entry.path, stat.st_atime, stat.st_size))
                    total_size += stat.st_size
        except OSError as e:
            log.warning(f"Failed to scan cache directory: {e}")
            return

        # If we exceed max_cache_bytes or if adding the new file will exceed it
        if total_size + incoming_bytes > self.max_cache_bytes:
            # Sort by access time (oldest first)
            cached_files.sort(key=lambda x: x[1])
            
            target_size = self.max_cache_bytes * 0.8  # Trim down to 80% capacity
            for path, atime, size in cached_files:
                if total_size + incoming_bytes <= target_size:
                    break
                try:
                    os.remove(path)
                    total_size -= size
                    log.info(f"Evicted old cached course DB: {path}")
                except Exception as e:
                    # File might be in use/locked by active connection on Windows, skip it
                    log.debug(f"Could not evict cached file {path}: {e}")

    def iter_shards(self) -> tuple[CourseDbShard, ...]:
        if self.metadata_shard:
            return (self.metadata_shard,)
        return self.shards

    def resolve_global_id(self, global_id: int) -> tuple[CourseDbShard, int]:
        if global_id < 0:
            raise ValueError("Global id must be non-negative")

        # The offset is the global_id rounded down to the nearest offset_step
        shard_offset = (global_id // self.offset_step) * self.offset_step
        shard = self._offset_to_shard.get(shard_offset)
        
        if not shard:
            raise ValueError(f"Global id {global_id} does not map to a configured shard (offset {shard_offset} not found)")

        local_id = global_id - shard.offset
        return shard, local_id

    def to_global_id(self, shard: CourseDbShard, local_id: int) -> int:
        return local_id + shard.offset

    def get_connection(self, shard: CourseDbShard) -> sqlite3.Connection:
        import pathlib
        
        # Resolve target database path (uses local cache if enabled)
        if self.metadata_shard and shard.index == -1:
            target_path = shard.db_path
        else:
            target_path = self._get_local_db_path(shard.db_path)
        
        # Construct a robust cross-platform SQLite URI
        abs_uri = pathlib.Path(target_path).absolute().as_uri()
        if self.connection_mode == "rw":
            optimized_uri = f"{abs_uri}?mode=rw"
        else:
            # immutable=1 & nolock=1 completely bypass SQLite file-locking overhead on FUSE/rclone mounts
            optimized_uri = f"{abs_uri}?mode=ro&nolock=1&immutable=1"
        
        conn = sqlite3.connect(optimized_uri, uri=True)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON;")
        
        # Aggressively tune PRAGMAs for network read performance
        try:
            conn.execute("PRAGMA mmap_size=268435456;") # 256MB mmap
            conn.execute("PRAGMA cache_size=-64000;")  # 64MB memory page cache
            conn.execute("PRAGMA journal_mode=OFF;")   # No journals for immutable files
        except sqlite3.OperationalError as e:
            log.warning("Could not apply some PRAGMAs to %s: %s", target_path, e)
            
        return conn

    def has_column(
        self,
        conn: sqlite3.Connection,
        shard: CourseDbShard,
        table: str,
        column: str,
    ) -> bool:
        columns = self._get_table_columns(conn, shard, table)
        return column in columns

    def invalidate_table_columns(self, shard: CourseDbShard, table: str | None = None) -> None:
        if table is None:
            keys = [key for key in self._table_columns_cache if key[0] == shard.db_path]
            for key in keys:
                self._table_columns_cache.pop(key, None)
            return

        self._table_columns_cache.pop((shard.db_path, table), None)

    def _get_table_columns(
        self,
        conn: sqlite3.Connection,
        shard: CourseDbShard,
        table: str,
    ) -> set[str]:
        key = (shard.db_path, table)
        cached = self._table_columns_cache.get(key)
        if cached is not None:
            return cached

        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        columns = {row["name"] for row in rows}
        self._table_columns_cache[key] = columns
        return columns
