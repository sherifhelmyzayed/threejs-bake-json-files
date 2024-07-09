# three.js playground

``` bash
# install dependencies
npm install
# bundle with webpack watching changes to ts and serve https://localhost:8090
npm dev
```

## Tips:
- Edit [src/Demo.ts](src/Demo.ts)
- To add test assets (keep them local):
  - Create a folder in root, append .local to it (ignored pattern from .gitignore), ie: 'assets.local'
  - This will be served by the same dev server and have the same base url, ie : `https://localhost:8090/assets.local/img.png`

---