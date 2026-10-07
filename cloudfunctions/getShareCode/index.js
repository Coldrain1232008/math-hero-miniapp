// 云函数：getShareCode
// 生成小程序码（wxacode.getUnlimited），供登录页的「邀请同行 / 分享小程序」使用。
//
// 为什么必须放云函数：
//   wxacode.getUnlimited 是服务端接口，要用 access_token 调。云开发提供「云调用」，
//   免去自己维护 access_token（不用配 AppSecret、不用管过期刷新）。
//
// ⚠️ 部署要点：
//   1. 必须**连同 config.json 一起上传**。里面声明了 openapi 调用权限，
//      漏了会报「权限不足 / errCode -604100」。
//   2. 小程序必须已发布 —— page 指向的页面要真实存在，否则报 path 不存在。
//
// 关于鉴权：本函数不读也不写任何业务数据，只是把一张图写进云存储，
// 生成的码本身也是公开信息，所以不做密钥鉴权。但 scene 限制了字符集，
// 避免被当作任意参数的生成器滥用。

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 小程序码指向的页面。必须是已发布版本里存在的页面，且不能带参数
// （微信规定参数只能放在 scene 里）。
const TARGET_PAGE = 'pages/login/login'

// 固定云存储路径：同名写入即覆盖，不会越攒越多
const CLOUD_PATH = 'share-codes/invite.png'

exports.main = async (event) => {
  // scene 会原样带进小程序，登录页可据此区分来源。
  // 微信硬限制：≤32 个可见字符，只支持数字、大小写字母和部分特殊字符；
  // 不支持 %，所以中文无法用 urlencode 处理，这里直接不允许中文。
  const scene = String((event && event.scene) || 'share')
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(scene)) {
    return {
      success: false,
      error: 'scene 参数不合法（仅限字母、数字、下划线、连字符，32 字符以内）',
    }
  }

  try {
    const res = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page: TARGET_PAGE,
      width: 430,
    })

    const upload = await cloud.uploadFile({
      cloudPath: CLOUD_PATH,
      fileContent: res.buffer,
    })

    console.log('getShareCode ok:', scene, upload.fileID)

    return {
      success: true,
      fileID: upload.fileID, // cloud:// 路径，小程序 <image> 可直接渲染
      scene,
      page: TARGET_PAGE,
    }
  } catch (err) {
    console.error('getShareCode error:', JSON.stringify(err))
    const msg = (err && (err.errMsg || err.message)) || '生成小程序码失败'
    return {
      success: false,
      error: /permission|权限|openapi/i.test(msg)
        ? '云调用权限未生效：请确认 config.json 与 index.js 一起上传，然后重新部署'
        : msg,
    }
  }
}
