// pages/character/character.js
const { calcLevel, calcAttributes, calcTitle, getTalentById, ATTR_NAMES } = require('../../utils/gameData')
const AvatarManager = require('../../utils/avatarManager')
const db = wx.cloud.database()

const ATTR_COLORS = ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444']

Page({
  data: {
    student: null,
    levelInfo: {},
    attrs: [],
    maxAttrVal: 100,
    attrDetail: [],
    growthDetail: [],
    expLogs: [],
    avatarInfo: {},
    attrNames: ATTR_NAMES,
    // 称号
    titleInfo: null,
    // 每日任务
    dailyTask: null,
    taskLoading: false,
    // 徽章
    badges: [],
    streakBadges: [],
    milestoneBadges: [],
    badgesLoading: false,
    showBadgeDetail: false,
    selectedBadge: null,
    // 徽章展示
    showcasedBadges: [],
    allBadges: [],
    totalBadgeCount: 0,
    achievedBadgeCount: 0,
    showBadgeSelector: false,
    badgeSelectorList: [],
    // 抽卡
    dailyDrawLeft: 3,
    challengeVouchers: 0,
    growthAccelerants: 0,
    // 修改口令
    showKeyDialog: false,
    newKeyInput: '',
    keyChanging: false,
    // 签到
    isCheckedIn: false,
    totalCheckInDays: 0,
    checkingIn: false,
    // 消息通知
    unreadCount: 0,
    // 金币
    coins: 0,
    totalCoinsEarned: 0,
    todayTransfer: null,
    // 赠送金币
    showTransferDialog: false,
    transferList: [],
    transferTarget: null,
    transferAmount: '',
    transferNote: '',
    transferring: false,
    loadingClassmates: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._updateRole()
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    let student = app.globalData.studentInfo
    if (!student) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }

    // 从数据库刷新最新数据
    try {
      const res = await wx.cloud.callFunction({
        name: 'getStudentData',
        data: { studentId: student._id }
      })
      if (res.result && res.result.success) {
        student = res.result.student
        app.globalData.studentInfo = student
      }
    } catch (e) { console.error(e) }

    const levelInfo = calcLevel(student.totalExp)
    const attrs = calcAttributes(student.talentId, levelInfo.level, student.growthMultiplier || 1.0)
    const maxAttrVal = Math.max(...attrs, 50)

    // 计算称号（优先使用数据库存储的，否则实时计算）
    const titleInfo = calcTitle(attrs, levelInfo.level)

    const attrDetail = ATTR_NAMES.map((name, i) => ({
      name,
      val: attrs[i],
      color: ATTR_COLORS[i],
      percent: Math.min(Math.round(attrs[i] / maxAttrVal * 100), 100),
    }))

    const talent = getTalentById(student.talentId)
    const growthDetail = talent ? ATTR_NAMES.map((name, i) => ({
      name,
      val: talent.growth[i],
      color: ATTR_COLORS[i],
    })) : []

    // 获取头像信息
    const avatarInfo = AvatarManager.getAvatarById(student.avatar) || AvatarManager.getRandomAvatar()

    // 加载最近10条经验记录
    let expLogs = []
    try {
      const logRes = await db.collection('expLogs')
        .where({ studentId: student._id })
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get()
      expLogs = logRes.data.map(log => ({
        ...log,
        typeLabel: {
          'score': '📝考试',
          'task': '⭐任务',
          'gacha': '🎰抽卡',
          'challenge_win': '⚔️挑战',
          'class': '⚡课堂',
        }[log.type] || '⚡其他',
        timeStr: this._formatTime(log.createdAt),
      }))
    } catch (e) { console.error(e) }

    // 计算每日抽卡剩余次数
    // 优先用 remainingDraws（单一字段）；兼容老数据用 dailyDrawLeft
    const today = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`
    const lastDrawDate = student.lastDrawDate || ''
    const isToday = lastDrawDate === today
    let dailyDrawLeft
    let bonusToday = 0
    if (isToday) {
      if (typeof student.remainingDraws === 'number' && !isNaN(student.remainingDraws)) {
        dailyDrawLeft = student.remainingDraws
        bonusToday = Math.max(0, student.remainingDraws - 3)
      } else {
        dailyDrawLeft = (typeof student.dailyDrawLeft === 'number' && !isNaN(student.dailyDrawLeft))
          ? student.dailyDrawLeft : 3
        bonusToday = Math.max(0, dailyDrawLeft - 3)
      }
    } else {
      dailyDrawLeft = 3  // 新的一天，基础3次
      bonusToday = 0
    }
    const baseDraw = 3  // 固定显示基础次数
    const challengeVouchers = student.challengeVouchers || 0
    const growthAccelerants = student.growthAccelerants || 0

    // 检查今日是否已签到
    const lastCheckInDate = student.lastCheckInDate || ''
    const isCheckedIn = lastCheckInDate === today
    const totalCheckInDays = student.totalCheckInDays || 0

    this.setData({
      student, levelInfo, attrs, maxAttrVal, attrDetail, growthDetail, expLogs, avatarInfo,
      titleInfo, dailyDrawLeft, baseDraw, challengeVouchers, growthAccelerants,
      isCheckedIn, totalCheckInDays,
      coins: student.coins || 0,
      totalCoinsEarned: student.totalCoinsEarned || 0,
    })

    // 加载每日任务
    this.loadDailyTask(student._id)
    // 加载徽章
    this.loadBadges(student._id)
    // 加载未读消息数
    this.loadUnreadCount(student._id)
    // 加载金币余额与今日赠送额度
    this.loadCoinSummary(student._id)
  },

  // 加载金币余额 + 今日剩余赠送额度
  async loadCoinSummary(studentId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoinLogs',
        data: { action: 'summary', studentId }
      })
      if (res.result && res.result.success) {
        this.setData({
          coins: res.result.coins || 0,
          totalCoinsEarned: res.result.totalCoinsEarned || 0,
          todayTransfer: res.result.todayTransfer || null,
        })
      }
    } catch (e) {
      console.error('加载金币信息失败:', e)
    }
  },

  // 跳转金币明细
  goCoinLogs() {
    wx.navigateTo({ url: '/pages/coin-logs/coin-logs' })
  },

  // 跳转金币商城
  goShop() {
    wx.navigateTo({ url: '/pages/shop/shop' })
  },

  // 打开赠送弹窗（拉取同班同学）
  async openTransfer() {
    const app = getApp()
    const student = app.globalData.studentInfo
    if (!student) return

    this.setData({ showTransferDialog: true, loadingClassmates: true, transferTarget: null, transferAmount: '', transferNote: '' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getClassmates',
        data: { studentId: student._id }
      })
      if (res.result && res.result.success) {
        this.setData({ transferList: res.result.classmates || [] })
      } else {
        this.setData({ transferList: [] })
        wx.showToast({ title: res.result?.error || '获取同学列表失败', icon: 'none' })
      }
    } catch (e) {
      console.error('获取同学列表失败:', e)
      this.setData({ transferList: [] })
    } finally {
      this.setData({ loadingClassmates: false })
    }
  },

  closeTransfer() {
    this.setData({ showTransferDialog: false })
  },

  selectTransferTarget(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10)
    const item = this.data.transferList[idx]
    if (!item) return
    this.setData({ transferTarget: item })
  },

  onTransferAmountInput(e) {
    // 只保留数字
    const val = (e.detail.value || '').replace(/[^\d]/g, '')
    this.setData({ transferAmount: val })
  },

  onTransferNoteInput(e) {
    this.setData({ transferNote: e.detail.value || '' })
  },

  async submitTransfer() {
    const app = getApp()
    const student = app.globalData.studentInfo
    const { transferTarget, transferAmount, transferNote, transferring } = this.data

    if (transferring) return
    if (!student) return
    if (!transferTarget) {
      wx.showToast({ title: '请选择赠送对象', icon: 'none' })
      return
    }

    const num = parseInt(transferAmount, 10)
    if (!num || num <= 0) {
      wx.showToast({ title: '请输入赠送金额', icon: 'none' })
      return
    }
    if (num > (this.data.coins || 0)) {
      wx.showToast({ title: '金币余额不足', icon: 'none' })
      return
    }

    const remain = this.data.todayTransfer
    if (remain) {
      if (remain.remainTimes <= 0) {
        wx.showToast({ title: `今日赠送次数已用完`, icon: 'none' })
        return
      }
      if (num > remain.remainAmount) {
        wx.showToast({ title: `今日最多还可赠 ${remain.remainAmount} 金币`, icon: 'none' })
        return
      }
    }

    this.setData({ transferring: true })
    wx.showLoading({ title: '赠送中...', mask: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'transferCoins',
        data: {
          studentId: student._id,
          toStudentId: transferTarget._id,
          amount: num,
          message: (transferNote || '').trim().slice(0, 30),
        }
      })

      if (res.result && res.result.success) {
        wx.hideLoading()
        this.setData({ showTransferDialog: false, transferring: false })
        wx.showToast({ title: `已赠出 ${num} 金币`, icon: 'success' })
        // 刷新余额与额度
        this.loadCoinSummary(student._id)
        // 同步 globalData，避免返回其他页面时显示的还是旧余额
        if (app.globalData.studentInfo) {
          app.globalData.studentInfo.coins = res.result.balance
        }
      } else {
        wx.hideLoading()
        this.setData({ transferring: false })
        wx.showToast({ title: res.result?.error || '赠送失败', icon: 'none', duration: 2500 })
      }
    } catch (e) {
      wx.hideLoading()
      this.setData({ transferring: false })
      console.error('赠送金币失败:', e)
      wx.showToast({ title: '赠送失败，请重试', icon: 'none' })
    }
  },

  // 加载未读消息数
  async loadUnreadCount(studentId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getNotifications',
        data: { studentId, page: 1, pageSize: 1 }
      })
      if (res.result && res.result.success) {
        this.setData({ unreadCount: res.result.unreadCount || 0 })
      }
    } catch (e) {
      console.error('加载未读消息数失败:', e)
    }
  },

  // 跳转消息页面
  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' })
  },

  // 跳转学习周报
  goWeeklyReport() {
    wx.navigateTo({ url: '/pages/weekly-report/weekly-report' })
  },

  // 加载每日任务
  async loadDailyTask(studentId) {
    this.setData({ taskLoading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'assignDailyTask',
        data: { studentId }
      })
      if (res.result && res.result.success) {
        this.setData({ dailyTask: res.result.task })
      }
    } catch (e) {
      console.error('加载任务失败:', e)
    } finally {
      this.setData({ taskLoading: false })
    }
  },

  // 刷新任务
  async refreshTask() {
    const { dailyTask, student } = this.data
    if (!dailyTask || !student) return

    // 特殊任务需要确认弹窗
    if (dailyTask.isSpecial) {
      wx.showModal({
        title: '刷新特殊任务',
        content: '⚠️ 特殊任务奖励丰厚！\n刷新后将失去这次完成特殊任务的机会，变更为普通任务。\n确定要刷新吗？',
        confirmText: '确定刷新',
        cancelText: '继续完成',
        success: async (res) => {
          if (!res.confirm) return
          await this._doRefreshTask()
        }
      })
      return
    }

    // 普通任务直接刷新
    const refreshCount = (dailyTask.refreshCount || 0) + 1
    if (refreshCount > 3) {
      wx.showToast({ title: '今日刷新次数已用完', icon: 'none' })
      return
    }

    await this._doRefreshTask()
  },

  // 执行刷新任务（内部方法）
  async _doRefreshTask() {
    const { dailyTask, student } = this.data
    if (!dailyTask || !student) return

    const refreshCount = (dailyTask.refreshCount || 0) + 1

    this.setData({ taskLoading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'assignDailyTask',
        data: { studentId: student._id, refreshCount }
      })
      if (res.result && res.result.success) {
        this.setData({ dailyTask: res.result.task })
        if (dailyTask.isSpecial) {
          wx.showToast({ title: '已刷新为普通任务', icon: 'success' })
        } else {
          wx.showToast({ title: '已刷新任务', icon: 'success' })
        }
      } else {
        wx.showToast({ title: res.result.error || '刷新失败', icon: 'none' })
      }
    } catch (e) {
      console.error('刷新任务失败:', e)
      wx.showToast({ title: '刷新失败', icon: 'none' })
    } finally {
      this.setData({ taskLoading: false })
    }
  },

  // 提交任务完成
  async submitTask() {
    const { dailyTask, student } = this.data
    if (!dailyTask || !student) return
    
    // 允许 pending 或 rejected 状态提交
    if (dailyTask.status !== 'pending' && dailyTask.status !== 'rejected') {
      wx.showToast({ title: '任务已提交或已完成', icon: 'none' })
      return
    }
    
    const isRetry = dailyTask.status === 'rejected'
    wx.showModal({
      title: '提交任务',
      content: isRetry ? '重新提交后老师会收到确认通知，确定已完成任务吗？' : '提交后老师会收到确认通知，确定已完成任务吗？',
      success: async (res) => {
        if (!res.confirm) return
        
        wx.showLoading({ title: '提交中...' })
        try {
          const result = await wx.cloud.callFunction({
            name: 'submitTask',
            data: {
              taskId: dailyTask.id,
              studentId: student._id
            }
          })
          
          wx.hideLoading()
          
          if (result.result && result.result.success) {
            // 更新本地状态
            this.setData({
              'dailyTask.status': 'submitted'
            })
            wx.showToast({ title: '已提交，等待老师确认', icon: 'success' })
          } else {
            wx.showToast({ title: result.result?.error || '提交失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          console.error('提交任务失败:', e)
          wx.showToast({ title: '提交失败', icon: 'none' })
        }
      }
    })
  },

  // 加载徽章
  async loadBadges(studentId) {
    this.setData({ badgesLoading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'checkBadges',
        data: { studentId }
      })
      
      // 即使 success 为 false，也要处理 allBadges（云函数出错时也会返回）
      if (res.result) {
        const badges = res.result.badges || []
        const allBadges = res.result.allBadges || []
        const totalBadgeCount = res.result.totalBadgeCount || allBadges.length
        const achievedBadgeCount = res.result.achievedBadgeCount || allBadges.filter(b => b.achieved).length
        
        // 分离连续徽章和里程碑徽章
        const streakBadges = badges
          .filter(b => b.badgeType === 'streak')
          .map(b => ({
            ...b,
            progressPercent: b.requiredDays ? Math.min(Math.round((b.currentStreak / b.requiredDays) * 100), 100) : 0
          }))
        
        const milestoneBadges = badges.filter(b => b.badgeType === 'milestone')
        
        // 获取用户选择展示的徽章
        const student = this.data.student
        const showcasedIds = student.showcasedBadges || []
        const showcasedBadges = showcasedIds
          .map(id => badges.find(b => b.badgeId === id))
          .filter(Boolean)
        
        this.setData({ 
          badges, 
          streakBadges, 
          milestoneBadges,
          allBadges,
          totalBadgeCount,
          achievedBadgeCount,
          showcasedBadges
        })
      }
    } catch (e) {
      console.error('加载徽章失败:', e)
    } finally {
      this.setData({ badgesLoading: false })
    }
  },

  // 显示徽章详情
  showBadgeDetail(e) {
    const badge = e.currentTarget.dataset.badge
    this.setData({
      showBadgeDetail: true,
      selectedBadge: badge
    })
  },

  // 隐藏徽章详情
  hideBadgeDetail() {
    this.setData({
      showBadgeDetail: false,
      selectedBadge: null
    })
  },

  // 跳转徽章图鉴页
  goBadgeBook() {
    wx.navigateTo({ url: '/pages/badge-book/badge-book' })
  },

  // 每日签到
  async doCheckIn() {
    const { isCheckedIn, student, checkingIn } = this.data
    if (isCheckedIn || checkingIn) return

    this.setData({ checkingIn: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'checkIn',
        data: { studentId: student._id }
      })

      if (res.result && res.result.success) {
        if (res.result.checked && !isCheckedIn) {
          // 签到成功，立即更新本地状态（防止重复点击）
          const today = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`

          this.setData({
            isCheckedIn: true,
            totalCheckInDays: res.result.totalCheckInDays,
            'student.lastCheckInDate': today
          })

          // 同步到 globalData
          const app = getApp()
          app.globalData.studentInfo.lastCheckInDate = today
          app.globalData.studentInfo.totalCheckInDays = res.result.totalCheckInDays

          wx.showToast({ title: '签到成功 +5EXP', icon: 'success' })

          // 延迟刷新页面数据（更新EXP等）
          setTimeout(() => {
            this.loadData()
          }, 1500)
        } else {
          wx.showToast({ title: res.result.message || '今日已签到', icon: 'none' })
        }
      } else {
        wx.showToast({ title: res.result?.error || '签到失败', icon: 'none' })
      }
    } catch (e) {
      console.error('签到失败:', e)
      wx.showToast({ title: '签到失败', icon: 'none' })
    } finally {
      this.setData({ checkingIn: false })
    }
  },

  // 打开徽章选择器
  openBadgeSelector() {
    const { allBadges, student } = this.data
    const showcasedIds = student.showcasedBadges || []
    
    // 构建选择器列表（只显示已获得的徽章）
    const badgeSelectorList = allBadges
      .filter(b => b.achieved)
      .map(b => ({
        ...b,
        selected: showcasedIds.includes(b.badgeId)
      }))
    
    this.setData({
      showBadgeSelector: true,
      badgeSelectorList
    })
  },

  // 关闭徽章选择器
  closeBadgeSelector() {
    this.setData({
      showBadgeSelector: false,
      badgeSelectorList: []
    })
  },

  // 切换徽章选中状态
  toggleBadge(e) {
    const badgeId = e.currentTarget.dataset.badgeId
    const { badgeSelectorList } = this.data
    const selectedCount = badgeSelectorList.filter(b => b.selected).length
    
    const newList = badgeSelectorList.map(b => {
      if (b.badgeId === badgeId) {
        // 如果已选中，取消选中
        if (b.selected) {
          return { ...b, selected: false }
        }
        // 如果未选中，检查是否超过上限
        if (selectedCount >= 3) {
          wx.showToast({ title: '最多展示3个徽章', icon: 'none' })
          return b
        }
        return { ...b, selected: true }
      }
      return b
    })
    
    this.setData({ badgeSelectorList: newList })
  },

  // 保存展示的徽章
  async saveShowcasedBadges() {
    const { badgeSelectorList, student } = this.data
    const selectedIds = badgeSelectorList.filter(b => b.selected).map(b => b.badgeId)
    
    wx.showLoading({ title: '保存中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateShowcasedBadges',
        data: {
          studentId: student._id,
          badgeIds: selectedIds
        }
      })
      
      wx.hideLoading()
      
      if (res.result && res.result.success) {
        // 更新本地数据
        const showcasedBadges = selectedIds
          .map(id => this.data.badges.find(b => b.badgeId === id))
          .filter(Boolean)
        
        this.setData({
          showcasedBadges,
          'student.showcasedBadges': selectedIds,
          showBadgeSelector: false,
          badgeSelectorList: []
        })
        
        // 同步到 globalData
        const app = getApp()
        app.globalData.studentInfo.showcasedBadges = selectedIds
        
        wx.showToast({ title: '保存成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.result?.error || '保存失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('保存展示徽章失败:', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async onReroll() {
    const { student } = this.data
    if (!student.rerollChances || student.rerollChances <= 0) return

    wx.showModal({
      title: '重置天赋',
      content: `你有 ${student.rerollChances} 次机会，确定要重新觉醒天赋吗？\n可以选择做天赋测试或跳过测试随机觉醒。`,
      success: async (res) => {
        if (!res.confirm) return
        wx.navigateTo({ url: '/pages/create-character/create-character?reroll=1' })
      },
    })
  },

  // 跳转抽卡页面
  goGacha() {
    wx.navigateTo({ url: '/pages/gacha/gacha' })
  },

  // ========== 修改口令 ==========
  showChangeKeyDialog() {
    this.setData({ showKeyDialog: true, newKeyInput: '' })
  },

  hideChangeKeyDialog() {
    this.setData({ showKeyDialog: false })
  },

  onNewKeyInput(e) {
    this.setData({ newKeyInput: e.detail.value })
  },

  async confirmChangeKey() {
    const { newKeyInput, student } = this.data
    if (!newKeyInput || newKeyInput.length < 6) {
      wx.showToast({ title: '口令至少6位', icon: 'none' })
      return
    }
    if (!/^[A-Za-z0-9]{6,20}$/.test(newKeyInput)) {
      wx.showToast({ title: '口令只能包含字母和数字', icon: 'none' })
      return
    }
    this.setData({ keyChanging: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateStudent',
        data: {
          action: 'changeKey',
          studentId: student._id,
          newKey: newKeyInput,
        },
      })
      if (res.result && res.result.success) {
        wx.showToast({ title: '口令修改成功', icon: 'success' })
        // 更新本地数据
        this.setData({
          'student.studentKey': newKeyInput,
          showKeyDialog: false,
          newKeyInput: '',
        })
        // 同步到 globalData
        const app = getApp()
        app.globalData.studentInfo.studentKey = newKeyInput
      } else {
        wx.showToast({ title: res.result?.error || '修改失败', icon: 'none' })
      }
    } catch (e) {
      console.error('修改口令失败:', e)
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
    this.setData({ keyChanging: false })
  },

  preventBubble() {},

  _formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },
})
