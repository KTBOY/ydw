/*
 * @Author: zlc
 * @Date: 2025-02-06 10:29:47
 * @LastEditTime: 2025-02-14 10:58:17
 * @LastEditors: zlc
 * @Description: 
 * @FilePath: \test\js\xls.js
 */
var xlsx = require('node-xlsx');
var fs = require('fs');
const path = require('path');
path.join(__dirname)
// =CONCAT(C3,"-",F3,"-",I3)

// 读取Excel数据
try {
    //内部表的数据
    var userTableData = [];
    //文件数据
    var tableData = xlsx.parse("粤电玩单机游戏+软件合集.xlsx");
    console.log('tableData', tableData);
    //循环读取表数据
    for (var val in tableData) {
        //下标数据
        var itemData = tableData[val];
        //内部表的名字
        if (itemData.name === '电脑游戏') {
            //循环读取用户表数据
            for (var index in itemData.data) {
                //0为表头数据
                if (index > 0) {
                    //
                    userTableData.push({
                        name: itemData.data[index][0],
                        urlK: itemData.data[index][1],
                        urlB: itemData.data[index][2],
                        passWord: itemData.data[index][3]|| '88888888',
                    });
                }

            }
        }
    }

    //输出表数据
    console.log("----输出表数据-------------", userTableData);
    // console.log('keys',keys,finallyArr);

    const writeFile = (url) => {

        let list = `export const list = ${JSON.stringify(userTableData)}`;

        fs.writeFile(url, list, function (err) {
            if (err) {
                console.log('写文件操作失败');
            } else {
                console.log('写文件操作成功');
            }
        });
    }
    writeFile('./b.js')
}
catch (e) {
    //输出日志
    console.log("excel读取异常,error=%s", e.stack);
}
