
功能结构
![image](https://github.com/user-attachments/assets/665e0d0c-6b12-44c3-8878-8e69241f0047)
![image](https://github.com/user-attachments/assets/9641afd9-e28d-4b8c-8ece-caf5b8155a8f)
![image](https://github.com/user-attachments/assets/5cdf0e3f-ec8b-4b5d-a81f-59cd08f3d7f1)
![image](https://github.com/user-attachments/assets/29112615-bc62-4d8e-84bb-b39b43b7da4d)



项目目录结构如下：

```
|-- tdesign-miniprogram-starter
    |-- README.md
    |-- app.js
    |-- app.json
    |-- app.wxss
    |-- components	//	公共组件库
    |-- config	//	基础配置
    |-- custom-tab-bar	//	自定义 tabbar
    |-- model	//	mock 数据
    |-- pages
    |-- services	//	请求接口
    |-- style	//	公共样式与iconfont
    |-- utils	//	工具库
```



### 4. 添加新页面

1. 在 `pages `目录下创建对应的页面文件夹
2. 在 `app.json` 文件中的 ` "pages"` 数组中加上页面路径
3. [可选] 在 `project.config.json` 文件的 `"miniprogram-list"` 下添加页面配置

## :hammer: 构建运行

1. `npm install`
2. 小程序开发工具中引入工程
3. 构建 npm

## :art: 代码风格控制

`eslint` `prettier`

## :iphone: 基础库版本

最低基础库版本`^2.6.5`


