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


class SQLiteCourseDatabase:
    """SQLite adapter for course/topic read APIs.

    Supports a multi-DB setup where each DB is assigned a 10000-step offset
    based on its index in the configured list.
    """

    engine = "sqlite"

    def __init__(self, db_paths: Sequence[str], offset_step: int = OFFSET_STEP):
        if offset_step <= 0:
            raise ValueError("offset_step must be positive")
        if not db_paths:
            raise ValueError("At least one course DB path must be configured")

        self.offset_step = offset_step
        self.shards = tuple(
            CourseDbShard(index=index, db_path=path, offset=index * offset_step)
            for index, path in enumerate(db_paths)
        )
        self._table_columns_cache: dict[tuple[str, str], set[str]] = {}

        if len(self.shards) > 1:
            entries = ", ".join(
                f"{shard.db_path} (offset {shard.offset})" for shard in self.shards
            )
            log.info("Course DB multi-db enabled: %s", entries)
        else:
            log.info("Course DB single-db mode: %s", self.shards[0].db_path)

    def iter_shards(self) -> tuple[CourseDbShard, ...]:
        return self.shards

    def resolve_global_id(self, global_id: int) -> tuple[CourseDbShard, int]:
        if global_id < 0:
            raise ValueError("Global id must be non-negative")

        shard_index = global_id // self.offset_step
        if shard_index >= len(self.shards):
            raise ValueError("Global id does not map to a configured shard")

        shard = self.shards[shard_index]
        local_id = global_id - shard.offset
        return shard, local_id

    def to_global_id(self, shard: CourseDbShard, local_id: int) -> int:
        return local_id + shard.offset

    def get_connection(self, shard: CourseDbShard) -> sqlite3.Connection:
        import pathlib
        
        # Construct a robust cross-platform SQLite URI
        abs_uri = pathlib.Path(shard.db_path).absolute().as_uri()
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
            log.warning("Could not apply some PRAGMAs to %s: %s", shard.db_path, e)
            
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
