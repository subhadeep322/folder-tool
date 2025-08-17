# AI Context Packer

Tired of copy-pasting files one by one into ChatGPT or Claude? This tool solves that.

`ai-pack` is a simple command-line utility that intelligently bundles your entire project's code into a single, clean text file. Get your entire codebase into any AI's context window with a single command.

![Demo GIF showing the ai-pack tool in action](https'://i.imgur.com/your-demo-image.gif') 
<!-- **Action Item:** Create a short GIF of the tool running and replace the link above! -->

## Features

-   **One Command, Full Context**: Run `ai-pack` in any project to get started instantly.
-   **Smart Ignoring**: Automatically reads your `.gitignore` file and skips `node_modules`, `.git`, and other clutter.
-   **AI-Optimized Format**: The text format includes a project tree, giving the AI a high-level overview before seeing the code.
-   **Copy to Clipboard**: Use the `-c` flag to send the entire project context directly to your clipboard.
-   **Powerful & Safe**: Won't crash on huge projects and warns you if the content is too large for your clipboard.

## Installation

You need [Node.js](https://nodejs.org/) installed on your system.

1.  **Clone this repository:**
    ```bash
    git clone [https://github.com/your-username/ai-context-packer.git](https://github.com/subhadeep322/folder-tool.git)
    ```

2.  **Navigate into the folder:**
    ```bash
    cd ai-context-packer
    ```

3.  **Install the tool's dependencies:**
    ```bash
    npm install
    ```

4.  **Make the `ai-pack` command available everywhere:**
    ```bash
    npm link
    ```
    *(On macOS/Linux, you might need to use `sudo npm link`)*

That's it! The `ai-pack` command is now available in any terminal, in any folder on your computer.

## How to Use It

The main goal is to get your code ready for an AI. Here's the command you'll use most often.

### The Magic Command for AI

Navigate to your project's root folder in the terminal and run this:

```bash
ai-pack -f text -c --no-binary
```

Let's break that down:
-   `-f text`: Creates a clean, human-readable **text** file.
-   `-c`: **Copies** the entire output to your clipboard.
-   `--no-binary`: Skips images, fonts, and other files that AIs can't read.

After running this, just go to your AI chat window and **paste (Ctrl+V or Cmd+V)**.

### Basic Usage

```bash
# Pack the current folder into a 'project-context.json' file
ai-pack

# You can also be explicit (does the same thing)
ai-pack .

# Pack a completely different folder without leaving your current location
ai-pack C:\Users\YourName\Documents\my-other-project
```

### All `pack` Options

The `pack` command is the default action.

| Command              | Alias | Description                                                               |
| -------------------- | ----- | ------------------------------------------------------------------------- |
| `[directory]`        |       | The folder to pack. Defaults to the current one.                          |
| `--output <file>`    | `-o`  | Set a custom name for the output file.                                    |
| `--format <type>`    | `-f`  | Output format. Can be `json` or `text` (default is `json`).               |
| `--copy`             | `-c`  | Copy the output to the clipboard.                                         |
| `--no-binary`        |       | Skip all binary files.                                                    |
| `--ignore <pattern>` | `-i`  | Add custom files/folders to ignore (e.g., `--ignore "docs"`).             |
| `--split`            | `-s`  | Split the output into smaller files (for very large projects).            |

### Unpacking a Bundle

If you have a `project-context.json` file created by this tool, you can restore the original folder structure.

```bash
# Restore the project from a bundle file
ai-pack unpack project-context.json

# Restore it into a specific folder
ai-pack unpack project-context.json -o ./my-restored-code
```

## Contributing


Found a bug or have a feature idea? Feel free to open an issue or submit a pull request!

