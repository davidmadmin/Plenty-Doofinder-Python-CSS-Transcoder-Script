# Plenty-Doofinder-Python-CSS-Transcoder-Script

Modify catalogue export CSVs to match the requirements for Doofinder.

## Features
- Cleans and normalises brand and category columns
- Adds group counts and ETA markings
- Drag-and-drop desktop app supporting multiple CSV files
- Simple CLI script for single-file processing

## Installation
1. Install [Python](https://www.python.org/downloads/) (3.11 or newer).
2. Clone this repository.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage
### Desktop app
```bash
python gui.py
```
Drag CSV files into the window or use **Select Files**. Each file is processed and the output CSV is written next to the original file with a time-stamped name.

### Command line
For a single file you can still use the CLI script:
```bash
python improvecsv.py
```
and follow the prompt.

## Building a Windows executable
On a Windows machine:
```bash
pip install -r requirements.txt pyinstaller
pyinstaller --name csv-transcoder --onefile --windowed gui.py
```
The bundled application will be in the `dist/` folder as `csv-transcoder.exe`.

## License
Released under the [MIT License](LICENSE). You are free to use, modify and distribute this software.
