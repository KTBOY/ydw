import WxRequest from './request'


//实例化 WxRequest
const instance = new WxRequest({
  //请填写自己后台的接口地址
  baseURL: 'http://192.168.xx.xx:8080/api',
  timeout: 60000
})

//配置请求拦截器
instance.interceptors.request = (config) => {
  //可以在这里做一些逻辑处理~~~~~
  // console.log(
  //   '%c------- 开始发送请求 -------',
  //   'color: #1E90FF; font-weight: bold'
  // )
  // console.log(
  //   `%c请求地址: %c${config.url}`,
  //   'color: #333; font-weight: bold',
  //   'color: #666'
  // )
  // console.log(
  //   `%c请求方式: %c${config.method || 'GET'}`,
  //   'color: #333; font-weight: bold',
  //   'color: #666'
  // )

  if (config.data) {
    //  console.log('%c请求参数:', 'color: #333; font-weight: bold', config.data)
  } else {
    //   console.log('%c请求参数: 无', 'color: #333; font-weight: bold')
  }

  if (config.header) {
    //   console.log('%c请求头:', 'color: #333; font-weight: bold', config.header)
  }

  console.log(
    '%c---------------------------',
    'color: #1E90FF; font-weight: bold'
  )
  return config
}



//配置响应拦截器
instance.interceptors.response = (response) => {
  //可以在这里做一些逻辑处理~~~~~
  // console.log(
  //   '%c------- 请求响应 -------',
  //   'color: #1E90FF; font-weight: bold'
  // )

  // // 打印基础信息
  // console.log(`%c请求地址: %c${response.config?.url || '未知'}`,
  //   'color: #333; font-weight: bold',
  //   'color: #666')

  // console.log(`%c请求方式: %c${response.config?.method || 'GET'}`,
  //   'color: #333; font-weight: bold',
  //   'color: #666')

  // 打印状态码（如果有）
  if (response.statusCode) {
    // const statusStyle = response.statusCode === 200 ?
    //   'color: #52c41a' : 'color: #f5222d'
    // console.log(`%c状态码: %c${response.statusCode}`,
    // 'color: #333; font-weight: bold',
    // `${statusStyle}; font-weight: bold`)
  }

  // 打印响应数据
  if (response.data) {
    //  console.log('%c响应数据:', 'color: #333; font-weight: bold', response.data)
  } else {
    //   console.log('%c响应数据: 无', 'color: #333; font-weight: bold')
  }

  // 打印请求是否成功（根据isSuccess标志）
  // console.log(`%c请求成功: %c${response.isSuccess ? '是' : '否'}`,
  //   'color: #333; font-weight: bold',
  //   `color: ${response.isSuccess ? '#52c41a' : '#f5222d'}; font-weight: bold`)

  // 打印错误信息（如果有）
  if (!response.isSuccess && response.errMsg) {
    console.log('%c错误信息:', 'color: #f5222d; font-weight: bold', response.errMsg)
  }

  console.log('-----------------------')
  return response
}

//记得要导出
export default instance