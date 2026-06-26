import logging
import hashlib
import time
import re
import requests
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

# In-memory cache for parsed notes
cache = {
    'data': None,
    'last_updated': 0,
    'expiry': 900  # 15 minutes cache
}

def generate_id(*args):
    """Generate a stable, unique ID based on input strings."""
    hasher = hashlib.md5()
    for arg in args:
        hasher.update(str(arg).encode('utf-8'))
    return hasher.hexdigest()

def clean_and_parse_html(html_content):
    """
    Parses a single feed entry's HTML content and splits it into discrete updates by <h3> tags.
    Returns a list of dicts containing the type, HTML content, and plain text.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    h3s = soup.find_all('h3')
    items = []
    
    if not h3s:
        # Fallback if there are no <h3> tags in the entry
        plain_text = soup.get_text().strip()
        # Keep basic HTML structure but make sure it's clean
        cleaned_html = str(soup)
        items.append({
            'type': 'General',
            'html': cleaned_html,
            'text': plain_text
        })
    else:
        for h3 in h3s:
            item_type = h3.get_text().strip()
            
            # Extract all sibling elements until the next h3 tag
            sibling = h3.next_sibling
            item_html_parts = []
            item_text_parts = []
            
            while sibling and sibling.name != 'h3':
                if sibling.name:
                    # Clean up attributes inside HTML elements (like style, target)
                    # but keep href for links
                    for tag in sibling.find_all(True):
                        # Remove styling and classes to prevent design leakage
                        tag.attrs = {k: v for k, v in tag.attrs.items() if k in ['href', 'src']}
                        # Make all links open in a new tab
                        if tag.name == 'a':
                            tag['target'] = '_blank'
                            tag['rel'] = 'noopener noreferrer'
                            
                    item_html_parts.append(str(sibling))
                    
                    # Formatted text processing based on block tag type
                    if sibling.name in ['ul', 'ol']:
                        list_items = []
                        for li in sibling.find_all('li'):
                            li_text = re.sub(r'\s+', ' ', li.get_text()).strip()
                            if li_text:
                                list_items.append(f"* {li_text}")
                        item_text_parts.append("\n".join(list_items))
                    elif sibling.name in ['pre', 'code']:
                        # Preserve formatting in preformatted blocks
                        item_text_parts.append(sibling.get_text())
                    else:
                        # Collapse internal consecutive whitespaces within regular paragraphs
                        p_text = re.sub(r'\s+', ' ', sibling.get_text()).strip()
                        if p_text:
                            item_text_parts.append(p_text)
                elif isinstance(sibling, str) and sibling.strip():
                    # Handle raw text nodes directly under h3
                    text_node = re.sub(r'\s+', ' ', sibling).strip()
                    if text_node:
                        item_html_parts.append(text_node)
                        item_text_parts.append(text_node)
                
                sibling = sibling.next_sibling
            
            item_html = "".join(item_html_parts).strip()
            # Join separate blocks with double newline to preserve paragraph separation
            item_text = "\n\n".join([part for part in item_text_parts if part]).strip()
            
            # Only add if we actually extracted content
            if item_html or item_text:
                items.append({
                    'type': item_type,
                    'html': item_html,
                    'text': item_text
                })
                
    return items

def fetch_and_parse_feed():
    """Fetches the Google feed and parses the updates."""
    try:
        logger.info(f"Fetching BigQuery release notes from {FEED_URL}...")
        response = requests.get(FEED_URL, headers=HEADERS, timeout=15)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        parsed_entries = []
        
        for entry in feed.entries:
            date_str = entry.title if hasattr(entry, 'title') else 'Unknown Date'
            updated_str = entry.get('updated', entry.get('published', ''))
            alternate_link = entry.get('link', '')
            
            # Feedparser puts html content inside a 'content' block, or falls back to 'summary'
            raw_content = ""
            if hasattr(entry, 'content') and entry.content:
                raw_content = entry.content[0].value
            elif hasattr(entry, 'summary'):
                raw_content = entry.summary
                
            sub_items = clean_and_parse_html(raw_content)
            
            for idx, item in enumerate(sub_items):
                # Generate a stable ID
                stable_id = generate_id(date_str, item['type'], idx, item['text'][:50])
                
                parsed_entries.append({
                    'id': stable_id,
                    'date': date_str,
                    'updated': updated_str,
                    'link': alternate_link,
                    'type': item['type'],
                    'html': item['html'],
                    'text': item['text']
                })
                
        logger.info(f"Successfully parsed {len(parsed_entries)} updates from feed.")
        return parsed_entries, None
        
    except Exception as e:
        logger.error(f"Error fetching/parsing feed: {str(e)}")
        return None, str(e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Return from cache if valid and refresh not forced
    if not force_refresh and cache['data'] is not None and (current_time - cache['last_updated']) < cache['expiry']:
        return jsonify({
            'status': 'success',
            'cached': True,
            'last_updated': cache['last_updated'],
            'data': cache['data']
        })
        
    # Fetch fresh data
    data, error = fetch_and_parse_feed()
    if error:
        # If fetch fails but we have cached data, return the cached data with a warning
        if cache['data'] is not None:
            return jsonify({
                'status': 'warning',
                'error': f"Failed to fetch updates ({error}). Showing cached content.",
                'cached': True,
                'last_updated': cache['last_updated'],
                'data': cache['data']
            }), 200
        return jsonify({
            'status': 'error',
            'error': f"Failed to retrieve feed: {error}"
        }), 500
        
    # Update cache
    cache['data'] = data
    cache['last_updated'] = current_time
    
    return jsonify({
        'status': 'success',
        'cached': False,
        'last_updated': current_time,
        'data': data
    })

if __name__ == '__main__':
    app.run(debug=True, port=8080)
