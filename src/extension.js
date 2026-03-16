const vscode = require('vscode');
const http = require('http');
const fs = require('fs');
const path = require('path');

let server;
let portFilePath;

function activate(context) {
    const out = vscode.window.createOutputChannel('Claude File Timeline');
    context.subscriptions.push(out);

    const preferredPort = vscode.workspace.getConfiguration('claudeFileTimeline').get('httpPort', 18463);
    const version = require('../package.json').version;

    server = http.createServer(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');

        if (req.method !== 'POST' || req.url !== '/sync') {
            res.writeHead(404);
            return res.end('{"error":"POST /sync"}');
        }

        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { files } = JSON.parse(body);
                if (!Array.isArray(files) || !files.length) {
                    res.writeHead(400);
                    return res.end('{"error":"files must be a non-empty array"}');
                }
                const results = await Promise.all(files.map(f => syncFile(f, out)));
                res.end(JSON.stringify({ results }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    });

    tryListen(preferredPort, 50, version, out);
}

function tryListen(port, retries, version, out) {
    server.listen(port, '127.0.0.1', () => {
        out.appendLine(`Listening on 127.0.0.1:${port} v${version}`);
        writePortFile(port, out);
    });

    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && retries > 0) {
            out.appendLine(`Port ${port} in use, trying ${port + 1}...`);
            server.close();
            const handler = server.listeners('request')[0];
            server = http.createServer(handler);
            tryListen(port + 1, retries - 1, version, out);
        } else {
            out.appendLine(`ERROR: ${err.message}`);
        }
    });
}

function writePortFile(port, out) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || !folders.length) return;

    portFilePath = path.join(folders[0].uri.fsPath, '.claude-port');
    try {
        fs.writeFileSync(portFilePath, String(port), 'utf-8');
    } catch (e) {
        out.appendLine(`Failed to write port file: ${e.message}`);
    }
}

function docRange(doc) {
    return new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
}

async function syncFile(filePath, out) {
    const fsPath = path.resolve(String(filePath));
    const uri = vscode.Uri.file(fsPath);

    try {
        const diskContent = fs.readFileSync(fsPath, 'utf-8');
        let doc = await vscode.workspace.openTextDocument(uri);

        // 若编辑器内容已与磁盘一致，先清空强制产生真实编辑以触发 Timeline 记录
        if (doc.getText() === diskContent) {
            const clear = new vscode.WorkspaceEdit();
            clear.delete(uri, docRange(doc));
            await vscode.workspace.applyEdit(clear);
            doc = await vscode.workspace.openTextDocument(uri);
        }

        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, docRange(doc), diskContent);
        await vscode.workspace.applyEdit(edit);
        await doc.save();

        out.appendLine(`[sync] ${fsPath}`);
        return { file: fsPath, status: 'synced' };
    } catch (e) {
        return { file: fsPath, status: 'error', error: e.message };
    }
}

function deactivate() {
    if (server) { server.close(); server = undefined; }
    if (portFilePath) {
        try { fs.unlinkSync(portFilePath); } catch (_) {}
        portFilePath = undefined;
    }
}

module.exports = { activate, deactivate };
