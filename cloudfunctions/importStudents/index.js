// cloudfunctions/importStudents/index.js
// 老师批量导入学生名单（预创建占位记录，生成学生密钥）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function genKey(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let key = ''
  for (let i = 0; i < len; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

exports.main = async (event) => {
  const { names, classId } = event
  if (!names || names.length === 0) return { success: false }

  try {
    const results = []
    for (const name of names) {
      // 检查是否已存在
      const exist = await db.collection('students')
        .where({ classId, realName: name })
        .get()
      if (exist.data.length > 0) {
        results.push({ name, key: exist.data[0].studentKey, status: 'exists' })
        continue
      }

      const studentKey = genKey(6)
      await db.collection('students').add({
        data: {
          classId,
          realName: name,
          heroName: name,           // 默认英雄名=真实名，学生可自行修改
          studentKey,               // 学生登录密钥
          openid: '',               // 待学生首次登录后绑定
          avatar: 'A1',
          gender: 'male',
          talentId: '',             // 待学生完成创建角色流程后赋值
          talentName: '未觉醒',
          talentCategory: '',
          talentColor: '#999',
          totalExp: 0,
          level: 1,
          rerollChances: 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      })
      results.push({ name, key: studentKey, status: 'created' })
    }

    return { success: true, results }
  } catch (e) {
    console.error(e)
    return { success: false, message: e.message }
  }
}
