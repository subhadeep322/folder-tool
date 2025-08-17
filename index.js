#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import ora from 'ora';
import clipboard from 'clipboardy';
import ignore from 'ignore';

// --- Configuration ---
const DEFAULT_IGNORE_PATTERNS = [
    'node_modules', '.git', 'dist', 'build', '.DS_Store',
    '*.log', 'yarn.lock', 'package-lock.json', 'pnpm-lock.yaml',
    '.env', '.env.*', '.vscode', '.idea', 'coverage', '*.gz', '*.zip',
];

const TEXT_EXTS = new Set([
  ".txt",".md",".js",".ts",".tsx",".jsx",".json",".yml",".yaml",".html",".css",".scss",".less",
  ".py",".java",".c",".cpp",".cs",".go",".rs",".php",".rb",".sh",".bash",".zsh",".env",".toml",
  ".ini",".cfg",".xml",".csv",".tsv",".mdx",".graphql",".gql",".svelte",".astro", ".vue"
]);

const CLIPBOARD_LIMIT_BYTES = 45 * 1024 * 1024; //45 MB

// --- Helper Functions ---
const isTextFile = (filePath) => TEXT_EXTS.has(path.extname(filePath).toLowerCase());

const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getGitIgnore = (dir, customIgnore) => {
    const gitignorePath = path.join(dir, '.gitignore');
    const ig = ignore().add(DEFAULT_IGNORE_PATTERNS);
    if (customIgnore && customIgnore.length > 0) {
        ig.add(customIgnore);
    }
    if (fs.existsSync(gitignorePath)) {
        ig.add(fs.readFileSync(gitignorePath).toString());
    }
    return ig;
};

function readFolderRecursive(dir, ig, baseDir, options) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (ig.ignores(relativePath)) {
            continue;
        }

        if (entry.isDirectory()) {
            files = files.concat(readFolderRecursive(fullPath, ig, baseDir, options));
        } else if (entry.isFile()) {
            const isText = isTextFile(fullPath);
            if (options.noBinary && !isText) {
                continue;
            }
            try {
                const content = fs.readFileSync(fullPath);
                files.push({
                    path: relativePath,
                    content: content
                });
            } catch (error) {
                console.warn(chalk.yellow(`\nCould not read file: ${relativePath}. Skipping.`));
            }
        }
    }
    return files;
}

function generateTree(files) {
    if (!files.length) return '';
    let tree = 'Project Structure:\n\n';
    const root = {};
    files.forEach(file => {
        file.path.split(path.sep).reduce((acc, part, i, parts) => {
            if (!acc[part]) acc[part] = {};
            if (i === parts.length - 1) acc[part].isFile = true;
            return acc[part];
        }, root);
    });

    const buildTree = (node, prefix = '') => {
        const entries = Object.keys(node);
        entries.forEach((entry, i) => {
            const isLast = i === entries.length - 1;
            tree += `${prefix}${isLast ? '└── ' : '├── '}${entry}\n`;
            if (!node[entry].isFile) {
                buildTree(node[entry], `${prefix}${isLast ? '    ' : '│   '}`);
            }
        });
    };
    buildTree(root);
    return tree + '\n---\n\n';
}

// --- Main Commands ---

async function packCommand(argv) {
    const spinner = ora(chalk.blue('Starting to pack project...')).start();
    try {
        const rootDir = path.resolve(argv.directory);
        if (!fs.existsSync(rootDir)) {
            spinner.fail(chalk.red(`Error: Directory not found at ${rootDir}`));
            return;
        }

        spinner.text = 'Reading .gitignore and scanning files...';
        const ig = getGitIgnore(rootDir, argv.ignore);
        const files = readFolderRecursive(rootDir, ig, rootDir, { noBinary: argv.noBinary });

        if (files.length === 0) {
            spinner.warn(chalk.yellow('No files found to pack. Check ignore patterns.'));
            return;
        }

        spinner.text = `Found ${files.length} files. Preparing bundle...`;

        const stats = { totalSize: 0, textFiles: 0, binaryFiles: 0 };
        const processedFiles = files.map(file => {
            const isText = isTextFile(file.path);
            stats.totalSize += file.content.length;
            isText ? stats.textFiles++ : stats.binaryFiles++;
            return {
                path: file.path,
                content: isText ? file.content.toString('utf-8') : file.content.toString('base64'),
                encoding: isText ? 'utf8' : 'base64'
            };
        });

        const bundle = {
            metadata: {
                source: path.basename(rootDir),
                createdAt: new Date().toISOString(),
                fileCount: processedFiles.length,
            },
            files: processedFiles,
        };

        let outputContent = '';
        if (argv.format === 'text') {
            const tree = generateTree(bundle.files);
            const fileContents = bundle.files.map(f =>
                `--- File: ${f.path} ---\n\n${f.encoding === 'utf8' ? f.content : '[Binary content not displayed]'}\n`
            ).join('\n---\n\n');
            outputContent = tree + fileContents;
        } else { // 'json' format
            outputContent = JSON.stringify(bundle, null, 2);
        }
        
        const outputPath = path.resolve(argv.output);

        if (argv.split) {
            spinner.text = 'Splitting content into chunks...';
            const manifest = {
                source: path.basename(rootDir),
                createdAt: new Date().toISOString(),
                parts: []
            };
            const baseOutput = outputPath.replace('.json', '').replace('.txt', '');
            let partIndex = 1;
            for (let i = 0; i < outputContent.length; i += argv.chunkSize) {
                const chunk = outputContent.substring(i, i + argv.chunkSize);
                const partPath = `${baseOutput}_part_${partIndex++}.${argv.format}`;
                fs.writeFileSync(partPath, chunk);
                manifest.parts.push(path.basename(partPath));
            }
            const manifestPath = `${baseOutput}_manifest.json`;
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            spinner.succeed(chalk.green(`Project split into ${manifest.parts.length} parts. Manifest created at ${manifestPath}`));

        } else {
             fs.writeFileSync(outputPath, outputContent);
             spinner.succeed(chalk.green(`Project successfully packed into ${outputPath}`));
        }
        
        console.log(
            chalk.cyan('✨ Summary: ') +
            chalk.bold(`${stats.textFiles} text files, ${stats.binaryFiles} binary files`) +
            ` — Total size: ${chalk.bold(formatBytes(stats.totalSize))}`
        );
        
        // --- MODIFIED CLIPBOARD LOGIC ---
        if (argv.copy) {
            const outputByteLength = Buffer.byteLength(outputContent, 'utf8');
            if (outputByteLength > CLIPBOARD_LIMIT_BYTES) {
                spinner.warn(chalk.yellow(
                    `📋 Content is too large (${formatBytes(outputByteLength)}) to copy to clipboard.`
                ));
                console.log(chalk.yellow(
                    `✨ Tip: Use the generated file '${path.basename(outputPath)}' or try the --split flag for very large projects.`
                ));
            } else {
                await clipboard.write(outputContent);
                console.log(chalk.cyan('📋 Content copied to clipboard!'));
            }
        }

    } catch (error) {
        spinner.fail(chalk.red(`An error occurred: ${error.message}`));
        console.error(error);
    }
}

async function unpackCommand(argv) {
    // Unpack logic remains the same.
    const spinner = ora(chalk.blue('Starting to unpack...')).start();
    try {
       const inputFile = path.resolve(argv.bundle);
       if (!fs.existsSync(inputFile)) {
           spinner.fail(chalk.red(`Error: Input file not found at ${inputFile}`));
           return;
       }

       let fullContent = '';
       if (path.basename(inputFile).endsWith('_manifest.json')) {
           spinner.text = 'Reading manifest and combining parts...';
           const manifest = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
           const inputDir = path.dirname(inputFile);
           for (const part of manifest.parts) {
               fullContent += fs.readFileSync(path.join(inputDir, part), 'utf-8');
           }
       } else {
           fullContent = fs.readFileSync(inputFile, 'utf-8');
       }

       spinner.text = 'Parsing bundle...';
       const bundle = JSON.parse(fullContent);
       const outDir = path.resolve(argv.output || `${bundle.metadata.source}_unpacked`);
       fs.mkdirSync(outDir, { recursive: true });

       spinner.text = `Unpacking ${bundle.files.length} files to ${outDir}...`;
       for (const file of bundle.files) {
           const destPath = path.join(outDir, file.path);
           fs.mkdirSync(path.dirname(destPath), { recursive: true });
           const content = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content;
           fs.writeFileSync(destPath, content);
       }

       spinner.succeed(chalk.green(`Successfully unpacked ${bundle.files.length} files to ${outDir}`));

    } catch (error) {
       spinner.fail(chalk.red(`An error occurred: ${error.message}`));
       console.error(error);
    }
}

// --- CLI Setup with yargs (No changes needed here) ---

yargs(hideBin(process.argv))
    .command(
        '$0 [directory]',
        'Pack a directory into a single file for AI context.',
        (yargs) => {
            return yargs
                .positional('directory', {
                    describe: 'The directory to pack. Defaults to the current directory.',
                    type: 'string',
                    default: '.',
                })
                .option('output', { alias: 'o', type: 'string', description: 'Output file path' })
                .option('format', { alias: 'f', type: 'string', description: 'Output format', choices: ['json', 'text'], default: 'json' })
                .option('copy', { alias: 'c', type: 'boolean', description: 'Copy the output to the clipboard', default: false })
                .option('split', { alias: 's', type: 'boolean', description: 'Split the output into multiple smaller chunks', default: false })
                .option('chunk-size', { type: 'number', description: 'The maximum size of each chunk in bytes', default: 1_000_000 })
                .option('ignore', { alias: 'i', type: 'array', description: 'Additional ignore patterns', default: [] })
                .option('no-binary', { type: 'boolean', description: 'Exclude binary files from the bundle', default: false });
        },
        (argv) => {
            if (!argv.output) {
                argv.output = argv.format === 'text' ? 'project-context.txt' : 'project-context.json';
            }
            packCommand(argv);
        }
    )
    .command(
        'unpack <bundle>',
        'Unpack a bundle file or manifest back into a folder structure.',
        (yargs) => {
            return yargs
                .positional('bundle', { describe: 'The bundle or _manifest.json to unpack', type: 'string' })
                .option('output', { alias: 'o', type: 'string', description: 'The directory to unpack the files into' });
        },
        unpackCommand
    )
    .help()
    .alias('help', 'h')
    .strict()
    .argv;