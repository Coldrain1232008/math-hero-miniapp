// components/radar-chart/radar-chart.js
const ATTR_COLORS = ['#6c63ff', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444']
const ATTR_NAMES = ['智识', '专注', '毅力', '灵感', '表达', '心志']

Component({
  properties: {
    attrs: { type: Array, value: [10, 10, 10, 10, 10, 10] },
    maxVal: { type: Number, value: 100 },
    size: { type: Number, value: 260 },
    mainColor: { type: String, value: '#6c63ff' },
  },

  data: {
    labels: [],
  },

  lifetimes: {
    ready() {
      this._drawRadar()
    },
  },

  observers: {
    'attrs, maxVal': function () {
      this._drawRadar()
    },
  },

  methods: {
    _drawRadar() {
      const { attrs, maxVal, size, mainColor } = this.properties
      const n = 6
      const cx = size / 2
      const cy = size / 2
      const r = size * 0.34
      const labelOffset = size * 0.44

      const query = this.createSelectorQuery()
      query.select('#radarCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res[0] || !res[0].node) return
        const canvas = res[0].node
        const dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = size * dpr
        canvas.height = size * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, size, size)

        // 背景网格（5层）
        for (let layer = 1; layer <= 5; layer++) {
          const ratio = layer / 5
          ctx.beginPath()
          for (let i = 0; i < n; i++) {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2
            const x = cx + r * ratio * Math.cos(angle)
            const y = cy + r * ratio * Math.sin(angle)
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.strokeStyle = 'rgba(255,255,255,0.08)'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // 轴线
        for (let i = 0; i < n; i++) {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // 数据区域
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const val = Math.min(attrs[i] || 0, maxVal)
          const ratio = val / maxVal
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2
          const x = cx + r * ratio * Math.cos(angle)
          const y = cy + r * ratio * Math.sin(angle)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fillStyle = mainColor + '30'
        ctx.fill()
        ctx.strokeStyle = mainColor
        ctx.lineWidth = 2.5
        ctx.stroke()

        // 数据点
        for (let i = 0; i < n; i++) {
          const val = Math.min(attrs[i] || 0, maxVal)
          const ratio = val / maxVal
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2
          const x = cx + r * ratio * Math.cos(angle)
          const y = cy + r * ratio * Math.sin(angle)
          ctx.beginPath()
          ctx.arc(x, y, 5, 0, Math.PI * 2)
          ctx.fillStyle = ATTR_COLORS[i]
          ctx.fill()
        }

        // 计算标签位置
        const labels = ATTR_NAMES.map((name, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2
          let x = cx + labelOffset * Math.cos(angle)
          let y = cy + labelOffset * Math.sin(angle)
          // 偏移修正，防止被边缘截断
          x = Math.max(0, Math.min(size - 60, x - 28))
          y = Math.max(0, Math.min(size - 44, y - 22))
          return { name, val: attrs[i] || 0, x, y, color: ATTR_COLORS[i] }
        })
        this.setData({ labels })
      })
    },
  },
})
