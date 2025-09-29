// Audio player component for the extension
class AudioPlayer {
  constructor(containerId) {
    this.container = document.getElementById(containerId)
    this.currentAudio = null
    this.isPlaying = false
    this.currentTrack = null
    this.volume = 0.8
    this.playbackRate = 1.0

    this.initializePlayer()
  }

  initializePlayer() {
    if (!this.container) return

    this.container.innerHTML = `
      <div class="audio-player">
        <div class="player-controls">
          <button class="play-btn" id="playBtn">
            <span class="play-icon">▶️</span>
            <span class="pause-icon" style="display: none;">⏸️</span>
          </button>
          <button class="stop-btn" id="stopBtn">⏹️</button>
          <div class="progress-container">
            <div class="progress-bar" id="progressBar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="time-display">
              <span id="currentTime">0:00</span> / <span id="totalTime">0:00</span>
            </div>
          </div>
        </div>
        
        <div class="player-settings">
          <div class="volume-control">
            <span class="volume-icon">🔊</span>
            <input type="range" id="volumeSlider" min="0" max="100" value="80" class="slider">
          </div>
          <div class="speed-control">
            <span class="speed-label">Speed:</span>
            <select id="speedSelect" class="speed-select">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1" selected>1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>

        <div class="track-info" id="trackInfo" style="display: none;">
          <div class="track-title" id="trackTitle"></div>
          <div class="track-details" id="trackDetails"></div>
        </div>
      </div>
    `

    this.bindEvents()
  }

  bindEvents() {
    const playBtn = document.getElementById("playBtn")
    const stopBtn = document.getElementById("stopBtn")
    const volumeSlider = document.getElementById("volumeSlider")
    const speedSelect = document.getElementById("speedSelect")
    const progressBar = document.getElementById("progressBar")

    playBtn?.addEventListener("click", () => this.togglePlayPause())
    stopBtn?.addEventListener("click", () => this.stop())
    volumeSlider?.addEventListener("input", (e) => this.setVolume(e.target.value / 100))
    speedSelect?.addEventListener("change", (e) => this.setPlaybackRate(Number.parseFloat(e.target.value)))
    progressBar?.addEventListener("click", (e) => this.seek(e))
  }

  async loadTrack(audioData, metadata = {}) {
    try {
      this.stop() // Stop current track if playing

      this.currentTrack = {
        ...audioData,
        metadata: {
          title: metadata.title || "Generated Rhyme",
          style: metadata.style || "Unknown",
          duration: metadata.duration || 0,
          service: audioData.service || "browser",
          ...metadata,
        },
      }

      if (audioData.playDirectly && audioData.utterance) {
        // Handle browser TTS utterance
        this.currentAudio = audioData.utterance
        this.setupUtteranceEvents()
      } else if (audioData.audioUrl) {
        // Handle audio URL/blob
        this.currentAudio = new Audio(audioData.audioUrl)
        this.setupAudioEvents()
      } else {
        throw new Error("No playable audio data provided")
      }

      this.updateTrackInfo()
      this.updateUI()

      return true
    } catch (error) {
      console.error("Failed to load track:", error)
      this.showError("Failed to load audio track")
      return false
    }
  }

  setupAudioEvents() {
    if (!this.currentAudio) return

    this.currentAudio.addEventListener("loadedmetadata", () => {
      this.updateDuration()
    })

    this.currentAudio.addEventListener("timeupdate", () => {
      this.updateProgress()
    })

    this.currentAudio.addEventListener("ended", () => {
      this.onTrackEnded()
    })

    this.currentAudio.addEventListener("error", (e) => {
      console.error("Audio playback error:", e)
      this.showError("Audio playback failed")
    })

    // Set initial volume and playback rate
    this.currentAudio.volume = this.volume
    this.currentAudio.playbackRate = this.playbackRate
  }

  setupUtteranceEvents() {
    if (!this.currentAudio) return

    this.currentAudio.onstart = () => {
      this.isPlaying = true
      this.updatePlayButton()
    }

    this.currentAudio.onend = () => {
      this.onTrackEnded()
    }

    this.currentAudio.onerror = (error) => {
      console.error("Speech synthesis error:", error)
      this.showError("Speech synthesis failed")
    }

    // Set voice properties
    this.currentAudio.volume = this.volume
    this.currentAudio.rate = this.playbackRate
  }

  togglePlayPause() {
    if (!this.currentAudio) return

    if (this.isPlaying) {
      this.pause()
    } else {
      this.play()
    }
  }

  async play() {
    if (!this.currentAudio) return

    try {
      if (this.currentAudio instanceof SpeechSynthesisUtterance) {
        // Handle browser TTS
        speechSynthesis.speak(this.currentAudio)
      } else {
        // Handle audio element
        await this.currentAudio.play()
      }

      this.isPlaying = true
      this.updatePlayButton()
    } catch (error) {
      console.error("Playback failed:", error)
      this.showError("Playback failed")
    }
  }

  pause() {
    if (!this.currentAudio) return

    if (this.currentAudio instanceof SpeechSynthesisUtterance) {
      speechSynthesis.pause()
    } else {
      this.currentAudio.pause()
    }

    this.isPlaying = false
    this.updatePlayButton()
  }

  stop() {
    if (!this.currentAudio) return

    if (this.currentAudio instanceof SpeechSynthesisUtterance) {
      speechSynthesis.cancel()
    } else {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
    }

    this.isPlaying = false
    this.updatePlayButton()
    this.updateProgress()
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))

    if (this.currentAudio) {
      if (this.currentAudio instanceof SpeechSynthesisUtterance) {
        this.currentAudio.volume = this.volume
      } else {
        this.currentAudio.volume = this.volume
      }
    }
  }

  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.25, Math.min(4, rate))

    if (this.currentAudio) {
      if (this.currentAudio instanceof SpeechSynthesisUtterance) {
        this.currentAudio.rate = this.playbackRate
      } else {
        this.currentAudio.playbackRate = this.playbackRate
      }
    }
  }

  seek(event) {
    if (!this.currentAudio || this.currentAudio instanceof SpeechSynthesisUtterance) {
      return // Can't seek with TTS
    }

    const progressBar = event.currentTarget
    const rect = progressBar.getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    const newTime = percent * this.currentAudio.duration

    this.currentAudio.currentTime = newTime
  }

  updateProgress() {
    const progressFill = document.getElementById("progressFill")
    const currentTimeEl = document.getElementById("currentTime")

    if (!progressFill || !currentTimeEl) return

    let currentTime = 0
    let duration = 0

    if (this.currentAudio && !(this.currentAudio instanceof SpeechSynthesisUtterance)) {
      currentTime = this.currentAudio.currentTime || 0
      duration = this.currentAudio.duration || 0
    }

    const percent = duration > 0 ? (currentTime / duration) * 100 : 0
    progressFill.style.width = `${percent}%`
    currentTimeEl.textContent = this.formatTime(currentTime)
  }

  updateDuration() {
    const totalTimeEl = document.getElementById("totalTime")
    if (!totalTimeEl) return

    let duration = 0
    if (this.currentAudio && !(this.currentAudio instanceof SpeechSynthesisUtterance)) {
      duration = this.currentAudio.duration || 0
    } else if (this.currentTrack?.metadata?.duration) {
      duration = this.currentTrack.metadata.duration
    }

    totalTimeEl.textContent = this.formatTime(duration)
  }

  updateTrackInfo() {
    const trackInfo = document.getElementById("trackInfo")
    const trackTitle = document.getElementById("trackTitle")
    const trackDetails = document.getElementById("trackDetails")

    if (!trackInfo || !this.currentTrack) return

    const metadata = this.currentTrack.metadata
    trackTitle.textContent = metadata.title
    trackDetails.textContent = `${metadata.style} • ${metadata.service}`
    trackInfo.style.display = "block"
  }

  updatePlayButton() {
    const playIcon = document.querySelector(".play-icon")
    const pauseIcon = document.querySelector(".pause-icon")

    if (playIcon && pauseIcon) {
      if (this.isPlaying) {
        playIcon.style.display = "none"
        pauseIcon.style.display = "inline"
      } else {
        playIcon.style.display = "inline"
        pauseIcon.style.display = "none"
      }
    }
  }

  updateUI() {
    this.updatePlayButton()
    this.updateDuration()
    this.updateProgress()
  }

  onTrackEnded() {
    this.isPlaying = false
    this.updatePlayButton()
    this.updateProgress()
  }

  showError(message) {
    // Simple error display - could be enhanced with better UI
    console.error("Audio Player Error:", message)

    // You could add a toast notification or error display here
    const errorDiv = document.createElement("div")
    errorDiv.className = "audio-error"
    errorDiv.textContent = message
    errorDiv.style.cssText = `
      background: #ff4444;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      margin: 8px 0;
      font-size: 12px;
    `

    this.container.appendChild(errorDiv)
    setTimeout(() => errorDiv.remove(), 3000)
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00"

    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Public methods for external control
  getCurrentTrack() {
    return this.currentTrack
  }

  isCurrentlyPlaying() {
    return this.isPlaying
  }

  destroy() {
    this.stop()
    if (this.container) {
      this.container.innerHTML = ""
    }
  }
}

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = AudioPlayer
} else if (typeof window !== "undefined") {
  window.AudioPlayer = AudioPlayer
}
