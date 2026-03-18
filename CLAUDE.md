## 文件变更同步到 VSCode Timeline（最高优先级）

在编辑任何文件**之前**，**必须**先将即将修改的所有文件通过 HTTP API 提交给 claude-file-timeline 插件，使插件保存一份编辑前的快照，方便后续 diff 对比。

完成所有文件编辑**之后**，**必须**再次将本次修改过的所有文件提交给插件，使变更记录出现在 VSCode Timeline 中，方便 diff 对比 review。

调用方式：先从工作区根目录的 `.claude-port` 文件读取实际端口号，再对本次会话中所有被 Edit/Write 修改过的文件发送一次 POST 请求：

```bash
PORT=$(cat .claude-port) && \
curl -s --noproxy '*' -X POST http://127.0.0.1:$PORT/sync \
  -H "Content-Type: application/json" \
  -d '{"files": ["/absolute/path/to/file1.py", "/absolute/path/to/file2.py"]}'
```

- 路径必须使用**绝对路径**
- 一次请求包含所有变更文件，无需逐个发送
- `--noproxy '*'` 必须携带，避免请求被代理拦截导致同步失败
- 若请求失败（插件未启动、`.claude-port` 不存在等），仅提示用户，不阻塞后续流程


## 变更文件列表（最高优先级）

完成任何文件变更后，**必须**列出所有变更文件。对每个变更文件调用 `Read(file_path, limit=1)`，工具输出的完整绝对路径在 VSCode 中可点击跳转到文件。**禁止**使用 markdown 链接语法或纯文本路径（均无法点击跳转）。