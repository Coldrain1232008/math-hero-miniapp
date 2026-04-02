// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    isTeacher: false,
    list: [
      {
        pagePath: '/pages/character/character',
        text: '我的角色',
        iconPath: '/images/tab_character.png',
        selectedIconPath: '/images/tab_character_active.png',
      },
      {
        pagePath: '/pages/ranking/ranking',
        text: '排行榜',
        iconPath: '/images/tab_rank.png',
        selectedIconPath: '/images/tab_rank_active.png',
      },
      {
        pagePath: '/pages/teacher/teacher',
        text: '教师',
        iconPath: '/images/tab_teacher.png',
        selectedIconPath: '/images/tab_teacher_active.png',
      },
      {
        pagePath: '/pages/teacher-task/teacher-task',
        text: '任务',
        iconPath: '/images/tab_task.png',
        selectedIconPath: '/images/tab_task_active.png',
      },
    ],
  },

  attached() {
    this._updateRole()
  },

  pageLifetimes: {
    show() {
      this._updateRole()
      this._updateSelected()
    },
  },

  methods: {
    _updateRole() {
      const app = getApp()
      const isTeacher = app.globalData.isTeacher || false
      // 根据角色动态过滤 list，学生不显示教师相关 tab
      const allList = [
        {
          pagePath: '/pages/character/character',
          text: '我的角色',
          iconPath: '/images/tab_character.png',
          selectedIconPath: '/images/tab_character_active.png',
        },
        {
          pagePath: '/pages/ranking/ranking',
          text: '排行榜',
          iconPath: '/images/tab_rank.png',
          selectedIconPath: '/images/tab_rank_active.png',
        },
        {
          pagePath: '/pages/teacher/teacher',
          text: '教师',
          iconPath: '/images/tab_teacher.png',
          selectedIconPath: '/images/tab_teacher_active.png',
        },
        {
          pagePath: '/pages/teacher-task/teacher-task',
          text: '任务',
          iconPath: '/images/tab_task.png',
          selectedIconPath: '/images/tab_task_active.png',
        },
      ]
      // 教师显示全部4个tab，学生只显示前2个
      const list = isTeacher ? allList : allList.filter(item => 
        item.pagePath !== '/pages/teacher/teacher' && 
        item.pagePath !== '/pages/teacher-task/teacher-task'
      )
      this.setData({ isTeacher, list })
    },

    _updateSelected() {
      const pages = getCurrentPages()
      if (pages.length === 0) return
      const currentPage = pages[pages.length - 1]
      const path = '/' + currentPage.route
      const { list } = this.data
      const idx = list.findIndex(item => item.pagePath === path)
      if (idx !== -1) {
        this.setData({ selected: idx })
      }
    },

    switchTab(e) {
      const idx = e.currentTarget.dataset.index
      const item = this.data.list[idx]
      wx.switchTab({ url: item.pagePath })
    },
  },
})
