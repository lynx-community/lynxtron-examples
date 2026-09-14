# create-browser-demo

从 Lynxtron Go 的 [browser 示例](../../showcases/browser) 创建独立浏览器工程，模板与 Go 共用源码。

在仓库根目录执行 `pnpm --filter create-browser-demo build` 生成模板。
生成器通过 `pnpm pack` 将 catalog/workspace 依赖转换成可安装的版本。

```sh
node packages/create-browser-demo/cli.js my-browser --no-web
cd my-browser
npm install
npm run start
```

使用 `--web` 保留原有的可选 Web 宿主。`npm run pack` 构建独立桌面安装包。
CEF 运行条件见生成工程的 README。
