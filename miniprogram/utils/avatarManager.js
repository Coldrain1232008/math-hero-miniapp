/**
 * 头像管理工具
 * 暂时用颜色块或文字头像，后续可替换为真实图片
 */

class AvatarManager {
  // 预设头像（颜色 + 文字组合）
  static getAvatars() {
    return [
      { id: 'avatar1', color: '#FF6B6B', icon: '🦊' },
      { id: 'avatar2', color: '#4ECDC4', icon: '🐱' },
      { id: 'avatar3', color: '#45B7D1', icon: '🐶' },
      { id: 'avatar4', color: '#96CEB4', icon: '🐸' },
      { id: 'avatar5', color: '#FFEAA7', icon: '🐰' },
      { id: 'avatar6', color: '#DDA0DD', icon: '🐼' },
      { id: 'avatar7', color: '#FF8C00', icon: '🦁' },
      { id: 'avatar8', color: '#20B2AA', icon: '🦉' },
      { id: 'avatar9', color: '#FF69B4', icon: '🐨' },
      { id: 'avatar10', color: '#32CD32', icon: '🐲' },
      { id: 'avatar11', color: '#9370DB', icon: '🦄' },
      { id: 'avatar12', color: '#FF4500', icon: '🐯' },
    ];
  }

  // 获取随机头像
  static getRandomAvatar() {
    const avatars = this.getAvatars();
    return avatars[Math.floor(Math.random() * avatars.length)];
  }

  // 根据ID获取头像
  static getAvatarById(id) {
    const avatars = this.getAvatars();
    return avatars.find(a => a.id === id) || this.getRandomAvatar();
  }
}

module.exports = AvatarManager;
