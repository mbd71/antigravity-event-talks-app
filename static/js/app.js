/**
 * BigQuery Release Pulse - Frontend Logic
 * Manages fetching, search filtering, card rendering, and Twitter sharing.
 */

document.addEventListener('DOMContentLoaded', () => {
    // App State
    let allNotes = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let isSyncing = false;

    // DOM Elements
    const elements = {
        notesTimeline: document.getElementById('notes-timeline'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        errorMessage: document.getElementById('error-message'),
        emptyState: document.getElementById('empty-state'),
        
        // Controls & Search
        refreshBtn: document.getElementById('refresh-btn'),
        exportCsvBtn: document.getElementById('export-csv-btn'),
        retryBtn: document.getElementById('retry-btn'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        resetSearchBtn: document.getElementById('reset-search-btn'),
        filterPills: document.querySelectorAll('.filter-pill'),
        
        // Sidebar Metrics
        statTotal: document.getElementById('stat-total'),
        statFeatures: document.getElementById('stat-features'),
        statChanges: document.getElementById('stat-changes'),
        statOthers: document.getElementById('stat-others'),
        statCards: document.querySelectorAll('.stat-card'),
        
        // Sidebar Sync Meta
        cacheBadge: document.getElementById('cache-badge'),
        lastUpdatedTime: document.getElementById('last-updated-time'),
        
        // Modal elements
        tweetModal: document.getElementById('tweet-modal'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        charCount: document.getElementById('char-count'),
        progressRing: document.querySelector('.progress-ring__circle'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
        copyTweetBtn: document.getElementById('copy-tweet-btn'),
        postTweetBtn: document.getElementById('post-tweet-btn'),
        
        // Float share & Toasts
        floatingShareBtn: document.getElementById('floating-share-btn'),
        toastContainer: document.getElementById('toast-container')
    };

    // Initialize Modal Circular Progress Ring
    const ringRadius = 9;
    const ringCircumference = 2 * Math.PI * ringRadius;
    if (elements.progressRing) {
        elements.progressRing.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
        elements.progressRing.style.strokeDashoffset = ringCircumference;
    }

    // ==========================================================================
    // TOAST NOTIFICATIONS
    // ==========================================================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'warning') icon = '⚠️';
        else if (type === 'error') icon = '🚨';
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-message">${message}</div>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        // Trigger exit animation and remove
        setTimeout(() => {
            toast.classList.add('dismissing');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3000);
    }

    // ==========================================================================
    // DATA FETCHING & SYNC
    // ==========================================================================
    async function fetchNotes(forceRefresh = false) {
        if (isSyncing) return;
        isSyncing = true;
        
        // Show loading state
        elements.refreshBtn.classList.add('syncing');
        elements.refreshBtn.disabled = true;
        
        elements.cacheBadge.className = 'badge loading';
        elements.cacheBadge.textContent = 'Fetching...';
        
        // Only show main spinner if it's the initial fetch
        if (allNotes.length === 0) {
            elements.notesTimeline.style.display = 'none';
            elements.emptyState.style.display = 'none';
            elements.errorState.style.display = 'none';
            elements.loadingState.style.display = 'flex';
        } else {
            showToast(forceRefresh ? 'Refreshing release notes...' : 'Checking for updates...', 'info');
        }

        try {
            const response = await fetch(`/api/notes?refresh=${forceRefresh}`);
            const result = await response.json();
            
            if (response.ok && result.status !== 'error') {
                allNotes = result.data || [];
                
                // Update Cache Status Badge
                elements.cacheBadge.textContent = result.cached ? 'Cached' : 'Fresh';
                elements.cacheBadge.className = result.cached ? 'badge cached' : 'badge fresh';
                
                // Update Last Updated Timestamp
                const date = new Date(result.last_updated * 1000);
                elements.lastUpdatedTime.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
                
                // Display content
                updateMetrics();
                renderTimeline();
                
                if (result.status === 'warning') {
                    showToast(result.error, 'warning');
                } else if (forceRefresh) {
                    showToast('Release notes successfully updated!', 'success');
                }
            } else {
                throw new Error(result.error || 'Server returned an error');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            elements.cacheBadge.textContent = 'Error';
            elements.cacheBadge.className = 'badge error';
            
            if (allNotes.length === 0) {
                elements.errorMessage.textContent = error.message;
                elements.loadingState.style.display = 'none';
                elements.errorState.style.display = 'flex';
            } else {
                showToast(`Sync failed: ${error.message}`, 'error');
            }
        } finally {
            isSyncing = false;
            elements.refreshBtn.classList.remove('syncing');
            elements.refreshBtn.disabled = false;
            elements.loadingState.style.display = 'none';
        }
    }

    // ==========================================================================
    // METRICS UPDATES
    // ==========================================================================
    function updateMetrics() {
        const total = allNotes.length;
        const features = allNotes.filter(n => n.type === 'Feature').length;
        const changes = allNotes.filter(n => n.type === 'Change').length;
        const others = total - features - changes;
        
        elements.statTotal.textContent = total;
        elements.statFeatures.textContent = features;
        elements.statChanges.textContent = changes;
        elements.statOthers.textContent = others;
        
        // Update filter counts on header pills
        document.getElementById('count-all').textContent = total;
        document.getElementById('count-features').textContent = features;
        document.getElementById('count-changes').textContent = changes;
        document.getElementById('count-announcements').textContent = allNotes.filter(n => n.type === 'Announcement').length;
        document.getElementById('count-fixes').textContent = allNotes.filter(n => n.type === 'Fix').length;
        document.getElementById('count-deprecations').textContent = allNotes.filter(n => n.type === 'Deprecation').length;
    }

    // ==========================================================================
    // RENDER TIMELINE CARDS
    // ==========================================================================
    function getFilteredNotes() {
        return allNotes.filter(note => {
            let matchesFilter = false;
            if (currentFilter === 'all') {
                matchesFilter = true;
            } else if (currentFilter === 'other-only') {
                matchesFilter = note.type !== 'Feature' && note.type !== 'Change';
            } else {
                matchesFilter = note.type === currentFilter;
            }
            
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || 
                note.type.toLowerCase().includes(searchLower) ||
                note.date.toLowerCase().includes(searchLower) ||
                note.text.toLowerCase().includes(searchLower);
                
            return matchesFilter && matchesSearch;
        });
    }

    function renderTimeline() {
        const filtered = getFilteredNotes();

        // Toggle visibility based on filtered length
        if (filtered.length === 0) {
            elements.notesTimeline.style.display = 'none';
            elements.emptyState.style.display = 'flex';
            return;
        }

        elements.emptyState.style.display = 'none';
        elements.notesTimeline.style.display = 'flex';
        elements.notesTimeline.innerHTML = '';

        // Group notes by date
        const groups = {};
        filtered.forEach(note => {
            if (!groups[note.date]) {
                groups[note.date] = [];
            }
            groups[note.date].push(note);
        });

        // Create timeline elements
        Object.entries(groups).forEach(([date, notesInGroup]) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'timeline-group';
            
            // Header for date
            const dateHeader = document.createElement('div');
            dateHeader.className = 'timeline-date-header';
            dateHeader.innerHTML = `
                <div class="timeline-dot"></div>
                <span class="timeline-date-title">${date}</span>
            `;
            groupEl.appendChild(dateHeader);
            
            // Cards for notes under this date
            notesInGroup.forEach(note => {
                const card = document.createElement('div');
                card.className = `note-card type-${note.type}`;
                card.id = `card-${note.id}`;
                
                // Keep track of this card's details
                card.dataset.noteId = note.id;
                
                card.innerHTML = `
                    <div class="card-header">
                        <span class="card-badge badge-${note.type}">${note.type}</span>
                        <div class="card-actions">
                            <button class="card-action-btn copy-btn" data-id="${note.id}" title="Copy to clipboard">
                                <svg class="btn-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                                Copy
                            </button>
                            <a href="${note.link}" target="_blank" class="card-action-btn" title="View official doc">
                                <svg class="btn-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                    <polyline points="15 3 21 3 21 9"/>
                                    <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                                Docs
                            </a>
                            <button class="card-action-btn tweet-btn" data-id="${note.id}">
                                <svg class="btn-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                                Tweet
                            </button>
                        </div>
                    </div>
                    <div class="card-content">
                        ${note.html}
                    </div>
                `;
                
                // Add click listener to card to highlight it
                card.addEventListener('click', (e) => {
                    // Don't trigger if they clicked an action button or link
                    if (e.target.closest('.card-action-btn') || e.target.closest('a')) return;
                    
                    document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected-highlight'));
                    card.classList.add('selected-highlight');
                });
                
                // Add click listener to Copy button
                const copyBtn = card.querySelector('.copy-btn');
                copyBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        await navigator.clipboard.writeText(note.text);
                        showToast('Card text copied to clipboard!', 'success');
                    } catch (err) {
                        console.error('Failed to copy card text:', err);
                        showToast('Failed to copy text.', 'error');
                    }
                });

                // Add click listener to Tweet button
                const tweetBtn = card.querySelector('.tweet-btn');
                tweetBtn.addEventListener('click', () => {
                    openTweetModal(note);
                });
                
                groupEl.appendChild(card);
            });
            
            elements.notesTimeline.appendChild(groupEl);
        });
    }

    // ==========================================================================
    // SEARCH & FILTER HANDLERS
    // ==========================================================================
    function handleSearch(e) {
        searchQuery = e.target.value;
        elements.clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        renderTimeline();
    }

    elements.searchInput.addEventListener('input', handleSearch);
    
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        elements.searchInput.focus();
        renderTimeline();
    });

    elements.resetSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        currentFilter = 'all';
        
        elements.filterPills.forEach(p => p.classList.remove('active'));
        document.querySelector('.filter-pill[data-filter="all"]').classList.add('active');
        
        elements.statCards.forEach(c => c.classList.remove('active'));
        
        renderTimeline();
    });

    // Header filter pills
    elements.filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            elements.filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            currentFilter = pill.dataset.filter;
            
            // Sync with stats-panel highlight
            elements.statCards.forEach(c => c.classList.remove('active'));
            if (currentFilter === 'all') {
                document.querySelector('.stat-card[data-stat="all"]').classList.add('active');
            } else if (currentFilter === 'Feature') {
                document.querySelector('.stat-card[data-stat="feature"]').classList.add('active');
            } else if (currentFilter === 'Change') {
                document.querySelector('.stat-card[data-stat="change"]').classList.add('active');
            } else {
                document.querySelector('.stat-card[data-stat="other"]').classList.add('active');
            }
            
            renderTimeline();
        });
    });

    // Sidebar stats click filters
    elements.statCards.forEach(card => {
        card.addEventListener('click', () => {
            elements.statCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            const statType = card.dataset.stat;
            elements.filterPills.forEach(p => p.classList.remove('active'));
            
            if (statType === 'all') {
                currentFilter = 'all';
                document.querySelector('.filter-pill[data-filter="all"]').classList.add('active');
            } else if (statType === 'feature') {
                currentFilter = 'Feature';
                document.querySelector('.filter-pill[data-filter="Feature"]').classList.add('active');
            } else if (statType === 'change') {
                currentFilter = 'Change';
                document.querySelector('.filter-pill[data-filter="Change"]').classList.add('active');
            } else {
                currentFilter = 'other-only';
                showToast('Filtering for other releases (Announcements, Fixes, Deprecations)...', 'info');
                document.querySelector('.filter-pill[data-filter="all"]').classList.add('active');
            }
            
            renderTimeline();
        });
    });

    function exportCurrentNotesToCSV() {
        const filtered = getFilteredNotes();
        if (filtered.length === 0) {
            showToast('No notes available to export.', 'warning');
            return;
        }
        
        // CSV Headers
        const headers = ['Date', 'Type', 'Description', 'Link'];
        
        // Helper to escape double quotes and wrap in quotes if needed
        const escapeCSVValue = (val) => {
            if (val === null || val === undefined) return '';
            let formatted = val.toString().trim();
            // Replace newlines and multiple spaces to keep it single line per cell
            formatted = formatted.replace(/\s+/g, ' ');
            // Escape double quotes
            if (formatted.includes('"') || formatted.includes(',') || formatted.includes('\n') || formatted.includes('\r')) {
                formatted = `"${formatted.replace(/"/g, '""')}"`;
            }
            return formatted;
        };
        
        // Generate rows
        const csvRows = [];
        csvRows.push(headers.join(','));
        
        filtered.forEach(note => {
            const row = [
                escapeCSVValue(note.date),
                escapeCSVValue(note.type),
                escapeCSVValue(note.text),
                escapeCSVValue(note.link)
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        const dateString = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_release_notes_${dateString}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`Successfully exported ${filtered.length} notes to CSV!`, 'success');
    }

    // Refresh and Export buttons
    elements.refreshBtn.addEventListener('click', () => fetchNotes(true));
    elements.retryBtn.addEventListener('click', () => fetchNotes(true));
    elements.exportCsvBtn.addEventListener('click', exportCurrentNotesToCSV);

    // ==========================================================================
    // TWEET MODAL & CHARACTER COUNTING
    // ==========================================================================
    function setProgressRing(percent) {
        const offset = ringCircumference - (percent / 100) * ringCircumference;
        elements.progressRing.style.strokeDashoffset = offset;
    }

    function openTweetModal(noteOrText, isSelection = false) {
        let defaultText = '';
        
        if (isSelection) {
            // Sharing custom highlighted text selection
            const maxSelectionLen = 180;
            let snippet = noteOrText.trim();
            if (snippet.length > maxSelectionLen) {
                snippet = snippet.substring(0, maxSelectionLen) + '...';
            }
            defaultText = `💡 Quick insight from the latest BigQuery release:\n\n"${snippet}"\n\nDetails: https://docs.cloud.google.com/bigquery/docs/release-notes #BigQuery #GoogleCloud`;
        } else {
            // Sharing a standard card note
            const date = noteOrText.date;
            const type = noteOrText.type;
            const link = noteOrText.link;
            let desc = noteOrText.text.trim();
            
            // Clean up description (collapse multiple spaces, newlines)
            desc = desc.replace(/\s+/g, ' ');
            
            // Generate clean tweet text, limiting the description length to fit X
            const maxDescLen = 140; 
            if (desc.length > maxDescLen) {
                desc = desc.substring(0, maxDescLen) + '...';
            }
            
            defaultText = `🚀 BigQuery Update (${date})\n\n[${type.toUpperCase()}] ${desc}\n\nRead official docs: ${link} #BigQuery #GoogleCloud`;
        }
        
        elements.tweetTextarea.value = defaultText;
        updateTweetCharCount();
        
        elements.tweetModal.classList.add('open');
        elements.tweetTextarea.focus();
    }

    function closeTweetModal() {
        elements.tweetModal.classList.remove('open');
    }

    function updateTweetCharCount() {
        const text = elements.tweetTextarea.value;
        const length = text.length;
        
        // Update literal character count text
        elements.charCount.textContent = `${length} / 280`;
        
        // Progress Ring Percentage
        const percent = Math.min(100, (length / 280) * 100);
        setProgressRing(percent);
        
        // Adjust colors and warning states
        if (length > 280) {
            elements.charCount.className = 'char-count exceeded';
            elements.progressRing.style.stroke = '#F91880'; // Pink/Red warning
            elements.postTweetBtn.disabled = true;
        } else if (length >= 260) {
            elements.charCount.className = 'char-count warning';
            elements.progressRing.style.stroke = '#FFAD1F'; // Yellow warning
            elements.postTweetBtn.disabled = false;
        } else {
            elements.charCount.className = 'char-count';
            elements.progressRing.style.stroke = '#1D9BF0'; // Default Blue
            elements.postTweetBtn.disabled = false;
        }
    }

    elements.tweetTextarea.addEventListener('input', updateTweetCharCount);
    elements.closeModalBtn.addEventListener('click', closeTweetModal);
    elements.cancelTweetBtn.addEventListener('click', closeTweetModal);
    
    // Close modal if clicking outside the card
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            closeTweetModal();
        }
    });

    // Copy to clipboard
    elements.copyTweetBtn.addEventListener('click', async () => {
        const text = elements.tweetTextarea.value;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Tweet copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy text:', err);
            showToast('Failed to copy text automatically.', 'error');
        }
    });

    // Post to X
    elements.postTweetBtn.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        if (text.length > 280) {
            showToast('Post exceeds X limit of 280 characters!', 'error');
            return;
        }
        const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(intentUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
        closeTweetModal();
        showToast('Opened Twitter web composer.', 'success');
    });

    // ==========================================================================
    // FLOATING SELECTION SHARE BUTTON
    // ==========================================================================
    let selectedTextForShare = '';

    function checkTextSelection(e) {
        // Prevent showing the floating tooltip when clicking inside the tooltips or modal
        if (e.target.closest('#floating-share-btn') || e.target.closest('#tweet-modal')) {
            return;
        }
        
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (!selectedText) {
            elements.floatingShareBtn.style.display = 'none';
            selectedTextForShare = '';
            return;
        }
        
        // Ensure the selection is actually inside a note card's content
        const anchorNode = selection.anchorNode;
        if (!anchorNode) return;
        
        const cardContentNode = anchorNode.parentElement.closest('.card-content');
        if (!cardContentNode) {
            elements.floatingShareBtn.style.display = 'none';
            selectedTextForShare = '';
            return;
        }
        
        selectedTextForShare = selectedText;
        
        // Position the floating share button above the text selection
        try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            elements.floatingShareBtn.style.left = `${rect.left + (rect.width / 2) - 75}px`;
            // Position 45px above the selection
            elements.floatingShareBtn.style.top = `${window.scrollY + rect.top - 45}px`;
            elements.floatingShareBtn.style.display = 'flex';
        } catch (err) {
            console.error('Error positioning floating share button:', err);
            elements.floatingShareBtn.style.display = 'none';
        }
    }

    document.addEventListener('mouseup', checkTextSelection);
    document.addEventListener('keyup', checkTextSelection);
    
    // Clear selection tooltip on scroll
    document.querySelector('.timeline-container').addEventListener('scroll', () => {
        elements.floatingShareBtn.style.display = 'none';
    });

    elements.floatingShareBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop mouseup trigger
        if (selectedTextForShare) {
            openTweetModal(selectedTextForShare, true);
            elements.floatingShareBtn.style.display = 'none';
            // Clear current browser selection for cleaner UI
            window.getSelection().removeAllRanges();
        }
    });

    // Set initial Highlight in stats panel
    document.querySelector('.stat-card[data-stat="all"]').classList.add('active');

    // Run Initial Load
    fetchNotes(false);
});
