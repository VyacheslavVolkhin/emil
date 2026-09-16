// Основной класс для управления медиаплеерами
class MediaPlayer {
    constructor(playerElement) {
        this.playerElement = playerElement;
        
        // Проверяем тип плеера
        this.playerType = playerElement.dataset.playerType || 'audio';
        
        // Для видео ищем элементы внутри video-container
        if (this.playerType === 'video') {
            this.videoContainer = playerElement.querySelector('.video-container');
            this.media = this.videoContainer ? this.videoContainer.querySelector('.player-media') : null;
        } else {
            // Для аудио ищем в соседнем элементе
            this.section = playerElement.closest('.player-section');
            this.media = this.section ? this.section.querySelector('.player-media') : null;
        }
        
        // Проверяем существование медиа элемента
        if (!this.media) {
            console.error('Не найден элемент .player-media для плеера', playerElement);
            return;
        }
        
        // Инициализируем основные элементы управления
        this.playPauseBtn = playerElement.querySelector('.play-pause-btn');
        this.progressBar = playerElement.querySelector('.progress-bar');
        this.progress = playerElement.querySelector('.progress');
        this.progressHandle = playerElement.querySelector('.progress-handle');
        this.currentTimeEl = playerElement.querySelector('.current-time');
        this.durationEl = playerElement.querySelector('.duration');
        
        // Для видео также ищем title
        if (this.playerType === 'video') {
            this.playerTitle = playerElement.querySelector('.player-title');
        }
        
        // Проверяем обязательные элементы
        const requiredElements = [
            { element: this.playPauseBtn, name: 'play-pause-btn' },
            { element: this.progressBar, name: 'progress-bar' },
            { element: this.progress, name: 'progress' },
            { element: this.currentTimeEl, name: 'current-time' },
            { element: this.durationEl, name: 'duration' }
        ];
        
        for (const { element, name } of requiredElements) {
            if (!element) {
                console.error(`Не найден элемент .${name} для плеера`, playerElement);
                return;
            }
        }
        
        this.playerId = playerElement.dataset.playerId || `${this.playerType}-${Date.now()}`;
        
        this.isSeeking = false;
        this.isPlaying = false;
        
        // Находим опциональные элементы
        this.prevBtn = playerElement.querySelector('.prev-btn');
        this.nextBtn = playerElement.querySelector('.next-btn');
        
        // Проверяем, инициализированы ли все обязательные элементы
        this.isValid = true;
        this.init();
    }
    
    init() {
        if (!this.isValid) return;
        
        // События кнопок
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        
        // События перемотки (если кнопки есть)
        if (this.prevBtn) {
            const skipValue = this.prevBtn.dataset.value ? parseInt(this.prevBtn.dataset.value) : -10;
            this.prevBtn.addEventListener('click', () => this.skip(skipValue));
        }
        
        if (this.nextBtn) {
            const skipValue = this.nextBtn.dataset.value ? parseInt(this.nextBtn.dataset.value) : 10;
            this.nextBtn.addEventListener('click', () => this.skip(skipValue));
        }
        
        // События медиа
        this.media.addEventListener('loadedmetadata', () => this.updateDuration());
        this.media.addEventListener('timeupdate', () => this.updateProgress());
        this.media.addEventListener('ended', () => this.onEnded());
        this.media.addEventListener('play', () => this.onPlay());
        this.media.addEventListener('pause', () => this.onPause());
        
        // Специфичные для видео события
        if (this.playerType === 'video') {
            // Автоскрытие контролов для видео
            this.videoContainer.addEventListener('mousemove', () => this.showVideoControls());
            this.videoContainer.addEventListener('mouseleave', () => this.hideVideoControls());
            
            // Клик по видео для play/pause
            this.media.addEventListener('click', () => this.togglePlay());
        }
        
        // Прогресс-бар события
        if (this.progressBar && this.progressHandle) {
            this.progressBar.addEventListener('click', (e) => this.seek(e));
            this.progressBar.addEventListener('mousedown', (e) => {
                this.isSeeking = true;
                this.seek(e);
                this.progressHandle.style.opacity = '1';
            });
            
            document.addEventListener('mousemove', (e) => {
                if (this.isSeeking) {
                    this.seek(e);
                }
            });
            
            document.addEventListener('mouseup', () => {
                this.isSeeking = false;
                this.progressHandle.style.opacity = '0';
            });
        }
        
        // Клавиатура (только для активного плеера)
        this.playerElement.addEventListener('click', () => {
            MediaPlayerManager.setActivePlayer(this.playerId);
        });
        
        // Обновляем длительность при загрузке
        if (this.media.readyState > 0) {
            this.updateDuration();
        }
        
        // Инициализируем иконки кнопок
        this.initIcons();
        
        // Устанавливаем начальное время
        this.updateProgress();
        
        // Для видео скрываем контролы через 3 секунды если видео не играет
        if (this.playerType === 'video') {
            this.hideControlsTimeout = null;
        }
    }
    
    initIcons() {
        if (!this.playPauseBtn) return;
        
        // Иконка для play/pause
        this.updatePlayPauseIcon();
        
        // Иконки для перемотки если есть кнопки
        if (this.prevBtn) {
            this.initPrevIcon();
        }
        
        if (this.nextBtn) {
            this.initNextIcon();
        }
    }
    
    initPrevIcon() {
        if (!this.prevBtn) return;
        
        const tooltip = this.prevBtn.querySelector('.tooltip');
        const tooltipHTML = tooltip ? tooltip.outerHTML : '';
        this.prevBtn.innerHTML = '&#9664;' + tooltipHTML;
    }
    
    initNextIcon() {
        if (!this.nextBtn) return;
        
        const tooltip = this.nextBtn.querySelector('.tooltip');
        const tooltipHTML = tooltip ? tooltip.outerHTML : '';
        this.nextBtn.innerHTML = '&#9654;' + tooltipHTML;
    }
    
    togglePlay() {
        if (this.media.paused) {
            this.play();
        } else {
            this.pause();
        }
    }
    
    play() {
        if (!this.isValid) return;
        
        // Приостанавливаем другие плееры того же типа
        MediaPlayerManager.pauseOtherPlayers(this.playerId, this.playerType);
        
        this.media.play().catch(error => {
            console.error('Ошибка воспроизведения:', error);
        });
        this.isPlaying = true;
        this.updatePlayPauseIcon();
        this.updatePlayPauseState();
        this.updateTooltip('Пауза');
        
        // Для видео показываем контролы при воспроизведении
        if (this.playerType === 'video') {
            this.showVideoControls();
            this.scheduleHideControls();
        }
    }
    
    pause() {
        if (!this.isValid) return;
        
        this.media.pause();
        this.isPlaying = false;
        this.updatePlayPauseIcon();
        this.updatePlayPauseState();
        this.updateTooltip('Воспроизвести');
        
        // Для видео показываем контролы при паузе
        if (this.playerType === 'video') {
            this.showVideoControls();
            clearTimeout(this.hideControlsTimeout);
        }
    }
    
    updatePlayPauseState() {
        if (!this.playPauseBtn) return;
        
        // Добавляем или удаляем класс active в зависимости от состояния
        if (this.isPlaying) {
            this.playPauseBtn.classList.add('active');
        } else {
            this.playPauseBtn.classList.remove('active');
        }
    }
    
    skip(seconds) {
        if (!this.isValid || !this.media.duration) return;
        
        const newTime = this.media.currentTime + seconds;
        this.media.currentTime = Math.max(0, Math.min(newTime, this.media.duration));
        this.updateProgress();
        
        // Для видео показываем контролы при перемотке
        if (this.playerType === 'video') {
            this.showVideoControls();
            this.scheduleHideControls();
        }
    }
    
    seek(event) {
        if (!this.isValid || !this.media.duration || !this.progressBar) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const pos = (event.clientX - rect.left) / rect.width;
        const time = Math.max(0, Math.min(pos * this.media.duration, this.media.duration));
        
        if (!isNaN(time)) {
            this.media.currentTime = time;
            this.updateProgress();
            
            // Для видео показываем контролы при перемотке
            if (this.playerType === 'video') {
                this.showVideoControls();
                this.scheduleHideControls();
            }
        }
    }
    
    updateProgress() {
        if (!this.isValid || !this.media.duration || !this.progress || !this.progressHandle) return;
        
        const percent = (this.media.currentTime / this.media.duration) * 100;
        this.progress.style.width = `${percent}%`;
        this.progressHandle.style.left = `${percent}%`;
        
        if (this.currentTimeEl) {
            this.currentTimeEl.textContent = this.formatTime(this.media.currentTime);
        }
    }
    
    updateDuration() {
        if (!this.isValid || !this.durationEl) return;
        
        this.durationEl.textContent = this.formatTime(this.media.duration);
    }
    
    onPlay() {
        this.isPlaying = true;
        this.updatePlayPauseIcon();
        this.updatePlayPauseState();
        this.updateTooltip('Пауза');
    }
    
    onPause() {
        this.isPlaying = false;
        this.updatePlayPauseIcon();
        this.updatePlayPauseState();
        this.updateTooltip('Воспроизвести');
    }
    
    onEnded() {
        this.pause();
        this.media.currentTime = 0;
        this.updateProgress();
        
        // Для видео скрываем контролы при окончании
        if (this.playerType === 'video') {
            this.showVideoControls();
            clearTimeout(this.hideControlsTimeout);
        }
    }
    
    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    updatePlayPauseIcon() {
        if (!this.playPauseBtn) return;
        
        const icon = this.isPlaying ? '&#10074;&#10074;' : '&#9658;';
        const tooltip = this.playPauseBtn.querySelector('.tooltip');
        const tooltipHTML = tooltip ? tooltip.outerHTML : '';
        this.playPauseBtn.innerHTML = icon + tooltipHTML;
    }
    
    updateTooltip(text) {
        const tooltip = this.playPauseBtn ? this.playPauseBtn.querySelector('.tooltip') : null;
        if (tooltip) {
            tooltip.textContent = text;
            this.playPauseBtn.setAttribute('title', text);
        }
    }
    
    // Методы для управления видео контролами
    showVideoControls() {
        if (this.playerType !== 'video' || !this.videoControls) return;
        
        this.videoControls.style.opacity = '1';
        this.videoControls.style.visibility = 'visible';
        
        clearTimeout(this.hideControlsTimeout);
    }
    
    hideVideoControls() {
        if (this.playerType !== 'video' || !this.videoControls || this.isSeeking || this.media.paused) return;
        
        this.videoControls.style.opacity = '0';
        setTimeout(() => {
            if (this.videoControls.style.opacity === '0') {
                this.videoControls.style.visibility = 'hidden';
            }
        }, 300);
    }
    
    scheduleHideControls() {
        if (this.playerType !== 'video') return;
        
        clearTimeout(this.hideControlsTimeout);
        this.hideControlsTimeout = setTimeout(() => {
            this.hideVideoControls();
        }, 3000);
    }
    
    // Публичные методы для управления извне
    playMedia() {
        if (this.isValid) {
            this.play();
        }
    }
    
    pauseMedia() {
        if (this.isValid) {
            this.pause();
        }
    }
    
    setVolume(volume) {
        if (this.isValid) {
            this.media.volume = Math.max(0, Math.min(1, volume));
        }
    }
}

// Класс для аудиоплеера с дополнительными функциями
class AudioPlayer extends MediaPlayer {
    constructor(playerElement) {
        super(playerElement);
        
        if (!this.isValid) return;
        
        this.repeatBtn = playerElement.querySelector('.repeat-btn');
        this.downloadBtn = playerElement.querySelector('.download-btn');
        this.isRepeating = false;
        
        this.initAudioFeatures();
    }
    
    initAudioFeatures() {
        if (!this.isValid) return;
        
        // Кнопка повтора
        if (this.repeatBtn) {
            this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
            this.initRepeatIcon();
        }
        
        // Кнопка скачивания
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => this.downloadAudio());
            this.initDownloadIcon();
        }
        
        // Переопределяем обработчик окончания для повтора
        this.media.removeEventListener('ended', () => this.onEnded());
        this.media.addEventListener('ended', () => this.onAudioEnded());
    }
    
    initRepeatIcon() {
        if (!this.repeatBtn) return;
        
        const tooltip = this.repeatBtn.querySelector('.tooltip');
        const tooltipHTML = tooltip ? tooltip.outerHTML : '';
        this.repeatBtn.innerHTML = '&#8635;' + tooltipHTML;
    }
    
    initDownloadIcon() {
        if (!this.downloadBtn) return;
        
        const tooltip = this.downloadBtn.querySelector('.tooltip');
        const tooltipHTML = tooltip ? tooltip.outerHTML : '';
        this.downloadBtn.innerHTML = '&#8595;' + tooltipHTML;
    }
    
    toggleRepeat() {
        if (!this.repeatBtn) return;
        
        this.isRepeating = !this.isRepeating;
        this.repeatBtn.classList.toggle('active', this.isRepeating);
        
        const title = this.isRepeating ? 'Выключить повтор' : 'Повтор';
        const tooltip = this.repeatBtn.querySelector('.tooltip');
        
        if (tooltip) {
            tooltip.textContent = title;
            this.repeatBtn.setAttribute('title', title);
        }
        
        // Меняем иконку при активном повторе
        const icon = this.isRepeating ? '&#8634;' : '&#8635;';
        this.repeatBtn.innerHTML = icon + this.repeatBtn.querySelector('.tooltip').outerHTML;
    }
    
    onAudioEnded() {
        if (this.isRepeating && this.isValid) {
            this.media.currentTime = 0;
            this.play();
        } else {
            this.onEnded();
        }
    }
    
    downloadAudio() {
        if (!this.downloadBtn || !this.media.src) return;
        
        try {
            const link = document.createElement('a');
            link.href = this.media.src;
            link.download = this.getFileNameFromUrl(this.media.src);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Визуальная обратная связь
            const tooltip = this.downloadBtn.querySelector('.tooltip');
            const originalHTML = this.downloadBtn.innerHTML;
            
            this.downloadBtn.innerHTML = '&#10004;' + tooltip.outerHTML;
            this.downloadBtn.classList.add('downloading');
            
            if (tooltip) {
                tooltip.textContent = 'Скачано!';
            }
            
            setTimeout(() => {
                this.downloadBtn.innerHTML = originalHTML;
                this.downloadBtn.classList.remove('downloading');
                if (tooltip) {
                    tooltip.textContent = 'Скачать';
                }
            }, 1000);
        } catch (error) {
            console.error('Ошибка при скачивании:', error);
        }
    }
    
    getFileNameFromUrl(url) {
        if (!url) return 'audio-track.mp3';
        return url.split('/').pop().split('?')[0] || 'audio-track.mp3';
    }
    
    // Метод для смены трека
    changeTrack(src, title, artist) {
        if (!this.isValid) return;
        
        this.pause();
        this.media.src = src;
        this.media.load();
        this.updateDuration();
        this.updateProgress();
    }
}

// Класс для видеоплеера
class VideoPlayer extends MediaPlayer {
    constructor(playerElement) {
        super(playerElement);
        
        if (!this.isValid) return;
        
        // Для видео находим video-controls
        this.videoControls = playerElement.querySelector('.video-controls');
        
        this.initVideoFeatures();
    }
    
    initVideoFeatures() {
        if (!this.isValid) return;
        
        // Инициализируем иконки для видео
        this.initVideoIcons();
        
        // Устанавливаем начальные стили для контролов
        if (this.videoControls) {
            this.videoControls.style.transition = 'opacity 0.3s, visibility 0.3s';
            this.videoControls.style.visibility = 'visible';
            this.videoControls.style.opacity = '1';
            
            // Скрываем контролы через 3 секунды если видео не играет
            if (this.media.paused) {
                this.scheduleHideControls();
            }
        }
    }
    
    initVideoIcons() {
        // Переопределяем иконки для видео (если нужно)
        if (this.prevBtn) {
            const tooltip = this.prevBtn.querySelector('.tooltip');
            const tooltipHTML = tooltip ? tooltip.outerHTML : '';
            this.prevBtn.innerHTML = '&#9664;' + tooltipHTML;
        }
        
        if (this.nextBtn) {
            const tooltip = this.nextBtn.querySelector('.tooltip');
            const tooltipHTML = tooltip ? tooltip.outerHTML : '';
            this.nextBtn.innerHTML = '&#9654;' + tooltipHTML;
        }
    }
}

// Менеджер для управления всеми плеерами на странице
class MediaPlayerManager {
    static players = new Map();
    static activePlayerId = null;
    
    static init() {
        // Инициализируем аудиоплееры
        this.initAudioPlayers();
        
        // Инициализируем видеоплееры
        this.initVideoPlayers();
        
        if (this.players.size > 0) {
            // Глобальные обработчики клавиатуры
            document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
            
            console.log(`Инициализировано плееров: ${this.players.size}`);
        }
    }
    
    static initAudioPlayers() {
        const audioElements = document.querySelectorAll('.audio-player');
        
        if (audioElements.length === 0) {
            console.log('Аудиоплееры не найдены на странице');
            return;
        }
        
        let initializedCount = 0;
        
        audioElements.forEach(playerElement => {
            try {
                const playerId = playerElement.dataset.playerId || `audio-${initializedCount + 1}`;
                
                // Если у элемента нет ID, добавляем его
                if (!playerElement.dataset.playerId) {
                    playerElement.dataset.playerId = playerId;
                }
                
                const player = new AudioPlayer(playerElement);
                
                // Проверяем, что плеер был успешно создан
                if (player.isValid !== false) {
                    this.players.set(playerId, player);
                    initializedCount++;
                }
            } catch (error) {
                console.error('Ошибка при инициализации аудиоплеера:', error, playerElement);
            }
        });
        
        if (initializedCount > 0) {
            console.log(`Инициализировано аудиоплееров: ${initializedCount}`);
        }
    }
    
    static initVideoPlayers() {
        const videoElements = document.querySelectorAll('.video-player');
        
        if (videoElements.length === 0) {
            console.log('Видеоплееры не найдены на странице');
            return;
        }
        
        let initializedCount = 0;
        
        videoElements.forEach(playerElement => {
            try {
                const playerId = playerElement.dataset.playerId || `video-${initializedCount + 1}`;
                
                // Если у элемента нет ID, добавляем его
                if (!playerElement.dataset.playerId) {
                    playerElement.dataset.playerId = playerId;
                }
                
                const player = new VideoPlayer(playerElement);
                
                // Проверяем, что плеер был успешно создан
                if (player.isValid !== false) {
                    this.players.set(playerId, player);
                    initializedCount++;
                }
            } catch (error) {
                console.error('Ошибка при инициализации видеоплеера:', error, playerElement);
            }
        });
        
        if (initializedCount > 0) {
            console.log(`Инициализировано видеоплееров: ${initializedCount}`);
        }
    }
    
    static setActivePlayer(playerId) {
        this.activePlayerId = playerId;
    }
    
    static getActivePlayer() {
        return this.activePlayerId ? this.players.get(this.activePlayerId) : null;
    }
    
    static pauseOtherPlayers(currentPlayerId, playerType) {
        // Пауза для всех плееров кроме текущего
        this.players.forEach((player, playerId) => {
            if (playerId !== currentPlayerId && player.isPlaying && player.isValid) {
                player.pauseMedia();
            }
        });
    }
    
    static handleGlobalKeydown(e) {
        const activePlayer = this.getActivePlayer();
        if (!activePlayer || !activePlayer.isValid) return;
        
        // Пробел для play/pause
        if (e.code === 'Space' && !e.target.matches('input, textarea, button')) {
            e.preventDefault();
            activePlayer.togglePlay();
        }
        
        // Стрелки для перемотки
        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            activePlayer.skip(-5);
        }
        
        if (e.code === 'ArrowRight') {
            e.preventDefault();
            activePlayer.skip(5);
        }
        
        // Клавиша R для повтора (только для аудио)
        if (e.code === 'KeyR' && activePlayer.playerType === 'audio') {
            e.preventDefault();
            if (activePlayer.repeatBtn) {
                activePlayer.toggleRepeat();
            }
        }
        
        // Клавиша M для mute
        if (e.code === 'KeyM') {
            e.preventDefault();
            activePlayer.setVolume(activePlayer.media.volume > 0 ? 0 : 1);
        }
        
        // Клавиша D для скачивания (только для аудио)
        if (e.code === 'KeyD' && activePlayer.playerType === 'audio') {
            e.preventDefault();
            if (activePlayer.downloadBtn) {
                activePlayer.downloadAudio();
            }
        }
        
        // Клавиша F для fullscreen (только для видео)
        if (e.code === 'KeyF' && activePlayer.playerType === 'video') {
            e.preventDefault();
            this.toggleFullscreen(activePlayer);
        }
        
        // Escape для выхода из fullscreen
        if (e.code === 'Escape' && activePlayer.playerType === 'video') {
            this.exitFullscreen();
        }
    }
    
    static toggleFullscreen(player) {
        if (!player.videoContainer) return;
        
        if (!document.fullscreenElement) {
            if (player.videoContainer.requestFullscreen) {
                player.videoContainer.requestFullscreen();
            } else if (player.videoContainer.webkitRequestFullscreen) {
                player.videoContainer.webkitRequestFullscreen();
            } else if (player.videoContainer.msRequestFullscreen) {
                player.videoContainer.msRequestFullscreen();
            }
        } else {
            this.exitFullscreen();
        }
    }
    
    static exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    
    // Публичные методы для управления плеерами
    static playPlayer(playerId) {
        const player = this.players.get(playerId);
        if (player && player.isValid) {
            player.playMedia();
        }
    }
    
    static pausePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player && player.isValid) {
            player.pauseMedia();
        }
    }
    
    static pauseAll() {
        this.players.forEach(player => {
            if (player.isPlaying && player.isValid) {
                player.pauseMedia();
            }
        });
    }
    
    static getPlayer(playerId) {
        return this.players.get(playerId);
    }
    
    static addPlayer(playerElement) {
        try {
            const playerType = playerElement.dataset.playerType || 'audio';
            const playerId = playerElement.dataset.playerId || `${playerType}-${this.players.size + 1}`;
            
            let player;
            if (playerType === 'video') {
                player = new VideoPlayer(playerElement);
            } else {
                player = new AudioPlayer(playerElement);
            }
            
            if (player.isValid !== false) {
                this.players.set(playerId, player);
                return player;
            }
        } catch (error) {
            console.error('Ошибка при добавлении плеера:', error);
        }
        return null;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, есть ли на странице плееры
    const hasAudioPlayers = document.querySelector('.audio-player') !== null;
    const hasVideoPlayers = document.querySelector('.video-player') !== null;
    
    if (hasAudioPlayers || hasVideoPlayers) {
        MediaPlayerManager.init();
        
        // Пример использования API
        window.mediaPlayers = MediaPlayerManager;
    } else {
        console.log('Плееры не найдены, инициализация не требуется');
    }
});

// Автоматическая инициализация при добавлении плееров динамически
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    // Проверяем аудиоплееры
                    if (node.matches('.audio-player')) {
                        MediaPlayerManager.addPlayer(node);
                    }
                    
                    // Проверяем видеоплееры
                    if (node.matches('.video-player')) {
                        MediaPlayerManager.addPlayer(node);
                    }
                    
                    // Проверяем внутри добавленных узлов
                    if (node.querySelector('.audio-player')) {
                        node.querySelectorAll('.audio-player').forEach(playerElement => {
                            MediaPlayerManager.addPlayer(playerElement);
                        });
                    }
                    
                    if (node.querySelector('.video-player')) {
                        node.querySelectorAll('.video-player').forEach(playerElement => {
                            MediaPlayerManager.addPlayer(playerElement);
                        });
                    }
                }
            });
        }
    });
});

// Начинаем наблюдение за изменениями в DOM
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Базовые стили
const style = document.createElement('style');
style.textContent = `
`;
document.head.appendChild(style);

// Экспорт для использования в модульной системе
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MediaPlayer,
        AudioPlayer,
        VideoPlayer,
        MediaPlayerManager
    };
}