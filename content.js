// Content script that runs on all webpages
class ContentExtractor {
  constructor() {
    this.selectors = {
      // Common article selectors
      article: 'article, [role="article"]',
      main: 'main, [role="main"]',
      content: ".content, .post-content, .entry-content, .article-content, .story-body",

      // News site specific selectors
      newsContent: ".story, .article-body, .post-body, .entry, .content-body",

      // Blog selectors
      blogContent: ".post, .blog-post, .entry, .article",

      // Generic content areas
      textContent: "p, h1, h2, h3, h4, h5, h6, li, blockquote, .text",

      // Elements to exclude
      exclude:
        "nav, header, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement, .social, .share, .comments, .related, .recommended, script, style, noscript",
    }
  }

  // Main extraction method
  extractContent() {
    try {
      // Try different extraction strategies
      let content =
        this.extractByStructure() ||
        this.extractByReadability() ||
        this.extractByTextDensity() ||
        this.extractFallback()

      // Clean and process the content
      content = this.cleanContent(content)

      // Get page metadata
      const metadata = this.getPageMetadata()

      return {
        content: content,
        title: metadata.title,
        url: metadata.url,
        wordCount: this.countWords(content),
        extractedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Content extraction failed:", error)
      return {
        content: "Unable to extract content from this page.",
        title: document.title || "Unknown Page",
        url: window.location.href,
        wordCount: 0,
        extractedAt: new Date().toISOString(),
      }
    }
  }

  // Extract content using semantic HTML structure
  extractByStructure() {
    // Try article tag first
    let contentElement = document.querySelector(this.selectors.article)

    if (!contentElement) {
      // Try main content area
      contentElement = document.querySelector(this.selectors.main)
    }

    if (!contentElement) {
      // Try common content class names
      contentElement = document.querySelector(this.selectors.content)
    }

    if (!contentElement) {
      // Try news/blog specific selectors
      contentElement =
        document.querySelector(this.selectors.newsContent) || document.querySelector(this.selectors.blogContent)
    }

    if (contentElement) {
      return this.extractTextFromElement(contentElement)
    }

    return null
  }

  // Extract content using readability algorithm
  extractByReadability() {
    const candidates = []
    const allElements = document.querySelectorAll("div, section, article")

    allElements.forEach((element) => {
      if (this.isExcludedElement(element)) return

      const textLength = this.getTextLength(element)
      const linkDensity = this.getLinkDensity(element)
      const paragraphCount = element.querySelectorAll("p").length

      // Score based on text length, paragraph count, and low link density
      const score = textLength * 0.5 + paragraphCount * 10 - linkDensity * 20

      if (score > 50) {
        candidates.push({ element, score })
      }
    })

    // Sort by score and return the best candidate
    candidates.sort((a, b) => b.score - a.score)

    if (candidates.length > 0) {
      return this.extractTextFromElement(candidates[0].element)
    }

    return null
  }

  // Extract content by finding areas with high text density
  extractByTextDensity() {
    const textElements = document.querySelectorAll(this.selectors.textContent)
    const densityMap = new Map()

    textElements.forEach((element) => {
      if (this.isExcludedElement(element)) return

      let parent = element.parentElement
      while (parent && parent !== document.body) {
        const currentDensity = densityMap.get(parent) || 0
        densityMap.set(parent, currentDensity + this.getTextLength(element))
        parent = parent.parentElement
      }
    })

    // Find the element with highest text density
    let bestElement = null
    let maxDensity = 0

    densityMap.forEach((density, element) => {
      if (density > maxDensity) {
        maxDensity = density
        bestElement = element
      }
    })

    if (bestElement && maxDensity > 200) {
      return this.extractTextFromElement(bestElement)
    }

    return null
  }

  // Fallback extraction method
  extractFallback() {
    // Get all paragraph text as a last resort
    const paragraphs = Array.from(document.querySelectorAll("p"))
      .filter((p) => !this.isExcludedElement(p))
      .map((p) => p.textContent.trim())
      .filter((text) => text.length > 20)

    if (paragraphs.length > 0) {
      return paragraphs.join("\n\n")
    }

    // Ultimate fallback - get body text
    return document.body.textContent.trim().substring(0, 2000)
  }

  // Extract text from a specific element
  extractTextFromElement(element) {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true)

    // Remove excluded elements
    const excludedElements = clone.querySelectorAll(this.selectors.exclude)
    excludedElements.forEach((el) => el.remove())

    // Get text content
    let text = clone.textContent || clone.innerText || ""

    // Clean up the text
    text = text.replace(/\s+/g, " ").trim()

    return text
  }

  // Clean and normalize extracted content
  cleanContent(content) {
    if (!content) return ""

    // Remove extra whitespace
    content = content.replace(/\s+/g, " ")

    // Remove common unwanted phrases
    const unwantedPhrases = [
      "Click here",
      "Read more",
      "Continue reading",
      "Share this",
      "Subscribe",
      "Sign up",
      "Log in",
      "Cookie policy",
      "Privacy policy",
    ]

    unwantedPhrases.forEach((phrase) => {
      const regex = new RegExp(phrase, "gi")
      content = content.replace(regex, "")
    })

    // Limit content length for API efficiency
    if (content.length > 3000) {
      content = content.substring(0, 3000) + "..."
    }

    return content.trim()
  }

  // Get page metadata
  getPageMetadata() {
    return {
      title: document.title || "Untitled Page",
      url: window.location.href,
      description: this.getMetaDescription(),
      author: this.getAuthor(),
      publishDate: this.getPublishDate(),
    }
  }

  // Get meta description
  getMetaDescription() {
    const metaDesc =
      document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]')
    return metaDesc ? metaDesc.getAttribute("content") : ""
  }

  // Get author information
  getAuthor() {
    const authorMeta =
      document.querySelector('meta[name="author"]') ||
      document.querySelector('[rel="author"]') ||
      document.querySelector(".author, .byline")
    return authorMeta ? authorMeta.getAttribute("content") || authorMeta.textContent : ""
  }

  // Get publish date
  getPublishDate() {
    const dateMeta =
      document.querySelector('meta[property="article:published_time"]') ||
      document.querySelector("time[datetime]") ||
      document.querySelector(".date, .published")
    return dateMeta ? dateMeta.getAttribute("datetime") || dateMeta.getAttribute("content") || dateMeta.textContent : ""
  }

  // Helper methods
  isExcludedElement(element) {
    if (!element) return true

    // Check if element matches excluded selectors
    try {
      return element.matches(this.selectors.exclude)
    } catch (e) {
      return false
    }
  }

  getTextLength(element) {
    return (element.textContent || "").trim().length
  }

  getLinkDensity(element) {
    const textLength = this.getTextLength(element)
    const linkLength = Array.from(element.querySelectorAll("a")).reduce(
      (total, link) => total + this.getTextLength(link),
      0,
    )

    return textLength > 0 ? linkLength / textLength : 0
  }

  countWords(text) {
    return text ? text.split(/\s+/).filter((word) => word.length > 0).length : 0
  }
}

// Initialize content extractor
const contentExtractor = new ContentExtractor()

// Listen for messages from the popup/background script
window.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractContent") {
    try {
      const extractedData = contentExtractor.extractContent()
      sendResponse({ success: true, data: extractedData })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  return true // Keep the message channel open
})

// Optional: Auto-extract content when page loads (for future features)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Could auto-extract and cache content here
  })
} else {
  // Document already loaded
  // Could auto-extract and cache content here
}