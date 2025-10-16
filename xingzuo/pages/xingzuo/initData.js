//  左侧栏总菜单
const starNavData = [{
    astroid: '1',
    astroname: '白羊座',
    icon: 'baiyangzuo',
    date: '3-21~4-19',
    code: '101'
  },
  {
    astroid: '2',
    icon: 'jinniuzuo',
    astroname: '金牛座',
    date: '4-20~5-20',
    code: '102'
  },
  {
    astroid: '3',
    icon: 'shuangzizuo',
    astroname: '双子座',
    date: '5-21~6-21',
    code: '103'
  },
  {
    astroid: '4',
    icon: 'juxiezuo',
    astroname: '巨蟹座',
    date: '6-22~7-22',
    code: '104'
  },
  {
    astroid: '5',
    icon: 'shizizuo',
    astroname: '狮子座',
    date: '7-23~8-22',
    code: '105'
  },
  {
    astroid: '6',
    icon: 'chunvzuo',
    astroname: '处女座',
    date: '8-23~9-22',
    code: '106'
  },
  {
    astroid: '7',
    icon: 'tianchengzuo',
    astroname: '天秤座',
    date: '9-23~10-23',
    code: '107'
  },
  {
    astroid: '8',
    icon: 'tianxiezuo',
    astroname: '天蝎座',
    date: '10-24~11-22',
    code: '108'
  },
  {
    astroid: '9',
    icon: 'sheshouzuo',
    astroname: '射手座',
    date: '11-23~12-21',
    code: '109'
  },
  {
    astroid: '10',
    icon: 'mojiezuo',
    astroname: '摩羯座',
    date: '12-22~1-19',
    code: '110'
  },
  {
    astroid: '11',
    icon: 'shuipingzuo',
    astroname: '水瓶座',
    date: '1-20~2-18',
    code: '111'
  },
  {
    astroid: '12',
    icon: 'shuangyuzuo',
    astroname: '双鱼座',
    date: '2-19~3-20',
    code: '112'
  },
]

const dateNavData = [{
    name: '今日',
    key: 'today',
  },
  {
    name: '明日',
    key: 'tomorrow',
  },
  {
    name: '本周',
    key: 'this_week',
  },
  {
    name: '本月',
    key: 'this_month',
  },
  {
    name: '今年',
    key: 'this_year',
  },

]

module.exports = {
  starNavData,
  dateNavData,
}