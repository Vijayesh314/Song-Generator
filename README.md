# RhymeTime Chrome Extension
Transform any webpage into fun, memorable rhymes and catchy songs using Google's Gemini AI!

## Features

### Smart Content Transformation
- Extracts main content from any webpage using advanced algorithms
- Transforms text into rhymes in multiple styles: Rap, Pop, Nursery Rhyme, Ballad, Country
- Customizable length and tone options
- Advanced prompt engineering for high-quality results

### Audio Generation
- Multiple text-to-speech services supported:
- Style-appropriate voice selection
- Playback controls with speed and volume adjustment

### Extensive Customization
- Quick presets for different use cases (Study, Fun, Kids, Chill)
- Advanced options with custom instructions
- Voice gender preferences
- Content extraction settings
- Multiple UI themes (Default, Dark, Colorful, Minimal)

### History & Management
- Save and organize generated rhymes
- Export/import settings
- Rhyme history with search and filtering
- Performance metrics and word counts

## Installation

### For Users
1. **Download the Extension**
   - Download the extension files from the developer
   - The extension comes pre-configured and ready to use!

2. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the extension folder
   - The RhymeTime icon will appear in your extensions toolbar

3. **Start Using**
   - Navigate to any webpage with text content
   - Click the RhymeTime extension icon
   - Choose your style and click "Transform Page"
   - No setup required - it works immediately!

## Usage

### Basic Usage
1. Navigate to any webpage with text content
2. Click the RhymeTime extension icon
3. Choose your preferred style, length, and tone
4. Click "Transform Page"
5. Enjoy your custom rhyme and audio!

### Advanced Features
- **Quick Presets**: Use preset buttons for common scenarios
- **Custom Instructions**: Add specific requirements in advanced options
- **Audio Services**: Configure premium TTS services for better voices
- **History**: Access previously generated rhymes
- **Sharing**: Share rhymes via native sharing or clipboard

### Settings
Access the settings page for:
- Audio service configuration
- Content extraction preferences
- UI customization
- History management

## Supported Websites

RhymeTime works on most websites including:
- News sites (CNN, BBC, Reuters, etc.)
- Blogs and articles
- Wikipedia pages
- Documentation sites
- E-commerce product pages
- Social media posts
- Academic papers

## Architecture

### Secure Proxy Server Design
- **Frontend**: Chrome extension handles UI and content extraction
- **Backend**: Secure proxy server manages all AI API calls
- **Security**: Your API key stays safely on the server, never exposed to users
- **Rate Limiting**: Built-in protection against abuse (10 requests/minute per user)

### API Services

**Included: Google Gemini (via Proxy)**
- **Purpose**: Text transformation and rhyme generation
- **Cost**: Covered by the extension developer
- **Setup**: No setup required for users!
- **Security**: API key protected on secure server

## Privacy & Security

- **No Data Collection**: Your content and rhymes are not stored on external servers
- **Local Processing**: Content extraction happens locally in your browser
- **Secure API**: API calls are proxied through a secure server
- **Protected Keys**: API keys never exposed in extension code
- **Rate Limited**: Prevents abuse and controls costs
- **Optional History**: Rhyme history is stored locally and can be disabled

## For Developers

### Setting Up the Backend Server

1. **Deploy the Proxy Server**
   \`\`\`bash
   cd server/
   npm install
   cp .env.example .env
   # Add your GEMINI_API_KEY to .env
   npm start
   \`\`\`

2. **Deploy to Production**
   - Deploy to Vercel, Railway, Heroku, or any hosting service
   - Set environment variable `GEMINI_API_KEY` with your Gemini API key
   - Update `PROXY_SERVER_URL` in `background.js` with your deployed URL

3. **Local Development**
   - Use `http://localhost:3000` as `PROXY_SERVER_URL`
   - Run the server locally with `npm run dev`

### File Structure
\`\`\`
rhyme-extension/
├── manifest.json          # Extension configuration
├── popup.html             # Main popup interface
├── popup.js               # Popup functionality
├── popup.css              # Popup styling
├── settings.html          # Settings page
├── settings.js            # Settings management
├── settings.css           # Settings styling
├── content.js             # Content extraction
├── background.js          # Background service worker (proxy calls)
├── audio-generator.js     # Audio generation system
├── audio-player.js        # Audio playback controls
├── icons/                 # Extension icons
└── server/                # Backend proxy server
    ├── server.js          # Express.js proxy server
    ├── package.json       # Server dependencies
    └── .env.example       # Environment variables template
\`\`\`

### Security Benefits
- **API Key Protection**: Keys never exposed in client-side code
- **Rate Limiting**: Prevents abuse and controls costs
- **CORS Protection**: Proper origin validation
- **Error Handling**: Graceful fallbacks for API failures

### Performance Tips

- **Shorter content** generates faster and more focused rhymes
- **Simple pages** (articles, blogs) work better than complex layouts
- **Stable internet** connection improves response times
- **Respect rate limits** to ensure consistent service

## Contributing

We welcome contributions! Areas for improvement:
- Additional audio service integrations
- New rhyme styles and formats
- Better content extraction algorithms
- UI/UX enhancements
- Performance optimizations
- Backend server improvements

## License

This project is open source. Please respect API terms of service for integrated services.