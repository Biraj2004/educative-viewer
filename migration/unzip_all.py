import os
import zipfile
import argparse
import sys

def main():
    parser = argparse.ArgumentParser(description="Recursively unzip all .zip files into folders named after the zip files.")
    parser.add_argument("--dir", nargs="?", default=".", help="The root directory to search for .zip files (defaults to current directory)")
    parser.add_argument("--delete", action="store_true", help="Delete the .zip files after successful extraction")
    args = parser.parse_args()

    base_dir = os.path.abspath(args.dir)
    if not os.path.isdir(base_dir):
        print(f"Error: Directory not found: {base_dir}")
        sys.exit(1)

    zip_count = 0
    print(f"Scanning {base_dir} for .zip files...")

    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.lower().endswith(".zip"):
                zip_path = os.path.join(root, file)
                # Remove the .zip extension to get the folder name
                zip_name = os.path.splitext(file)[0]
                target_dir = os.path.join(root, zip_name)

                print(f"\nFound: {zip_path}")
                
                try:
                    # Create the target directory if it doesn't exist
                    os.makedirs(target_dir, exist_ok=True)
                    
                    print(f"Extracting to: {target_dir}")
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(target_dir)
                    
                    zip_count += 1
                    print("Extraction successful.")
                    
                    # Optional cleanup
                    if args.delete:
                        os.remove(zip_path)
                        print("Deleted original .zip file.")

                except zipfile.BadZipFile:
                    print(f"Error: Corrupted or invalid zip file '{zip_path}'")
                except Exception as e:
                    print(f"Error extracting '{zip_path}': {e}")

    print(f"\nDone! Successfully extracted {zip_count} zip files.")

if __name__ == "__main__":
    main()
