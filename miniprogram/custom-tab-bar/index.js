Component({
  data: {
    selected: 0,
    role: null, // 'student' | 'teacher'
    list: [
      {
        pagePath: '/pages/character/character',
        text: '我的角色',
        iconName: 'user',
        selectedIconName: 'user-fill'
      },
      {
        pagePath: '/pages/ranking/ranking',
        text: '排行榜',
        iconName: 'chart',
        selectedIconName: 'chart-fill'
      },
      {
        pagePath: '/pages/teacher/teacher',
        text: '教师',
        iconName: 'calendar',
        selectedIconName: 'calendar-fill'
      }
    ]
  },
  lifetimes: {
    attached() {
      this._updateRole()
    }
  },
  methods: {
    _updateRole() {
      const app = getApp()
      this.setData({ role: app.globalData.isTeacher ? 'teacher' : 'student' })
    },
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const url = this.data.list[index].pagePath

      // 学生不能访问教师页面
      if (this.data.role === 'student' && url.includes('/teacher/')) {
        wx.showToast({ title: '教师功能', icon: 'none' })
        return
      }

      wx.switchTab({ url })
    }
  }
})
