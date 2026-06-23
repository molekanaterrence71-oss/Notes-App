/**
 * Notes App - script.js
 * 
 * This file handles all the frontend state management, DOM manipulation,
 * and database integration with Supabase.
 * 
 * Beginners: If you haven't set up Supabase yet, this app will automatically
 * run in "Local Storage Mode". Once you paste your database credentials below,
 * it will swap to your real Supabase real-time cloud database!
 */

// ==========================================
// 1. SUPABASE DATABASE CONFIGURATION
// ==========================================
// STEP 1: Go to your Supabase Project Dashboard (https://supabase.com)
// STEP 2: Navigate to Project Settings -> API
// STEP 3: Copy your "Project URL" and paste it into the variable below
// STEP 4: Copy your "anon" / "public" API key and paste it into the second variable below

const SUPABASE_URL = "https://uesfpyjmwwjkunthimva.supabase.co/rest/v1/Notes";
const SUPABASE_ANON_KEY = "https://uesfpyjmwwjkunthimva.supabase.co/rest/v1/";

// ==========================================
// 2. STATE IDENTIFIERS & VARIABLES
// ==========================================
let supabaseClient = null;      // Hold the Supabase client connection
let notesCache = [];            // Local cache of notes to render
let isLocalOnly = true;         // True if running locally, False if running via Supabase Cloud
let activeEditId = null;        // Keep track of which note is being modified in the modal
let currentLayout = "grid";     // User-facing view layout: 'grid' or 'list'

// ==========================================
// 3. DOCUMENT ELEMENTS (DOM SELECTORS)
// ==========================================
const noteForm = document.getElementById("add-note-form");
const noteTitleInput = document.getElementById("note-title");
const noteContentInput = document.getElementById("note-content");
const notesContainer = document.getElementById("notes-list");
const notesCountBadge = document.getElementById("notes-count-badge");
const connStatusIndicator = document.getElementById("connection-status");
const connStatusText = document.getElementById("connection-status-text");
const setupWarningBanner = document.getElementById("setup-warning-banner");

// Layout selector buttons
const gridViewBtn = document.getElementById("grid-view-btn");
const listViewBtn = document.getElementById("list-view-btn");

// Editing Modal items
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-note-form");
const editTitleInput = document.getElementById("edit-note-title");
const editContentInput = document.getElementById("edit-note-content");
const closeModalBtn = document.getElementById("modal-close-btn");
const cancelModalBtn = document.getElementById("modal-cancel-btn");

// Toast Notification Container
const toastContainer = document.getElementById("toast-container");

// ==========================================
// 4. MAIN INITIALIZATION
// ==========================================
function init() {
  checkSupabaseConfiguration();
  registerEventListeners();
  loadViewPreferences();
  fetchNotes();
}

/**
 * Validates if the user has changed the default placeholder Supabase keys.
 * If credentials are configured, it initializes the Supabase client.
 * Otherwise, it activates Local Storage Mode so the app is immediately usable.
 */
function checkSupabaseConfiguration() {
  const isPlaceholderUrl = !SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL_HERE" || SUPABASE_URL.trim() === "";
  const isPlaceholderKey = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY_HERE" || SUPABASE_ANON_KEY.trim() === "";

  if (isPlaceholderUrl || isPlaceholderKey) {
    // Run in backup local mode
    isLocalOnly = true;
    showSetupWarning();
    setConnectionStatus("offline");
    showToast("Running in Local Storage Sandbox mode. Set up Supabase keys to save in the cloud!", "info");
  } else {
    try {
      // Connect to real Supabase via the global window object loaded from the CDN link
      if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        isLocalOnly = false;
        hideSetupWarning();
        setConnectionStatus("online");
        showToast("Connected to your Supabase Cloud Database!", "success");
      } else {
        throw new Error("Supabase CDN script failed to load correctly.");
      }
    } catch (error) {
      console.error("Database connection failure:", error);
      isLocalOnly = true;
      showSetupWarning();
      setConnectionStatus("offline");
      showToast("Supabase setup failed. Falling back to Local Storage.", "error");
    }
  }
}

// Update the visual status pill in the navbar
function setConnectionStatus(status) {
  if (status === "online") {
    connStatusIndicator.classList.remove("local-mode");
    connStatusText.textContent = "Supabase Cloud";
  } else {
    connStatusIndicator.classList.add("local-mode");
    connStatusText.textContent = "Local Sandbox";
  }
}

function showSetupWarning() {
  if (setupWarningBanner) {
    setupWarningBanner.style.display = "block";
  }
}

function hideSetupWarning() {
  if (setupWarningBanner) {
    setupWarningBanner.style.display = "none";
  }
}

// ==========================================
// 5. DATA MUTATIONS (CRUD OPERATIONS)
// ==========================================

/**
 * Fetch Notes: Reads notes from either Supabase database or Local Storage.
 */
async function fetchNotes() {
  try {
    if (isLocalOnly) {
      // Local Storage Mode
      const localData = localStorage.getItem("supabase_notes_fallback");
      notesCache = localData ? JSON.parse(localData) : getPlaceholderNotes();
    } else {
      // Supabase Mode
      // Execute standard SQL query order by created_at in descending order
      const { data, error } = await supabaseClient
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      notesCache = data || [];
    }
    
    renderNotes();
  } catch (error) {
    console.error("Error fetching notes:", error);
    showToast("Error loading notes: " + error.message, "error");
  }
}

/**
 * Create Note: Add a new entry to the database table.
 */
async function addNote(title, content) {
  try {
    const newNoteObj = {
      title: title.trim(),
      content: content.trim()
    };

    if (isLocalOnly) {
      // Mock automatic columns of standard database
      const localNote = {
        id: Date.now(), // Unique numeric id
        title: newNoteObj.title,
        content: newNoteObj.content,
        created_at: new Date().toISOString()
      };
      notesCache.unshift(localNote);
      localStorage.setItem("supabase_notes_fallback", JSON.stringify(notesCache));
    } else {
      // Cloud Insert
      const { data, error } = await supabaseClient
        .from("notes")
        .insert([newNoteObj])
        .select();

      if (error) throw error;
    }

    showToast("Note added successfully!", "success");
    fetchNotes(); // Re-fetch list to guarantee real sync and refresh automatically
  } catch (error) {
    console.error("Error creating note:", error);
    showToast("Failed to save note: " + error.message, "error");
  }
}

/**
 * Update Note: Modifies title and content fields.
 */
async function updateNote(id, updatedTitle, updatedContent) {
  try {
    if (isLocalOnly) {
      notesCache = notesCache.map(note => {
        if (note.id == id) {
          return {
            ...note,
            title: updatedTitle.trim(),
            content: updatedContent.trim()
          };
        }
        return note;
      });
      localStorage.setItem("supabase_notes_fallback", JSON.stringify(notesCache));
    } else {
      const { error } = await supabaseClient
        .from("notes")
        .update({
          title: updatedTitle.trim(),
          content: updatedContent.trim()
        })
        .eq("id", id);

      if (error) throw error;
    }

    showToast("Note updated successfully!", "success");
    closeModal();
    fetchNotes(); // Re-fetch list to guarantee real sync and refresh automatically
  } catch (error) {
    console.error("Error modifying note:", error);
    showToast("Failed to modify note: " + error.message, "error");
  }
}

/**
 * Delete Note: Remove notes row by its key ID.
 */
async function deleteNote(id) {
  // Confirm with user
  if (!confirm("Are you sure you want to delete this note? This action cannot be undone.")) {
    return;
  }

  try {
    if (isLocalOnly) {
      notesCache = notesCache.filter(note => note.id != id);
      localStorage.setItem("supabase_notes_fallback", JSON.stringify(notesCache));
    } else {
      const { error } = await supabaseClient
        .from("notes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    }

    showToast("Note deleted successfully.", "success");
    fetchNotes(); // Re-fetch list to guarantee real sync and refresh automatically
  } catch (error) {
    console.error("Error deleting note:", error);
    showToast("Failed to delete note: " + error.message, "error");
  }
}

// ==========================================
// 6. RENDER ENGINE & COMPONENT CREATION
// ==========================================

/**
 * Renders list of cached notes inside grid/list. Handles empty states.
 */
function renderNotes() {
  // Update note count indicator
  notesCountBadge.textContent = notesCache.length;

  if (notesCache.length === 0) {
    notesContainer.innerHTML = `
      <div id="empty-state" class="empty-state">
        <div class="empty-state-icon">📝</div>
        <h3>No notes here yet</h3>
        <p>Write your first title and content on the left panel to save a persistent note.</p>
      </div>
    `;
    return;
  }

  // Inject notes HTML
  notesContainer.innerHTML = notesCache.map(note => {
    // Format timestamp nicely for humans
    const formattedDate = formatTimestamp(note.created_at);

    return `
      <div id="note-${note.id}" class="note-card">
        <div class="note-body">
          <h3 class="note-card-title">${escapeHTML(note.title)}</h3>
          <p class="note-card-content">${escapeHTML(note.content)}</p>
        </div>
        <div class="note-footer">
          <span class="note-date" title="${note.created_at}">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${formattedDate}
          </span>
          <div class="note-actions">
            <!-- Edit Note trigger -->
            <button class="action-btn action-btn-edit" onclick="triggerEditNote(${note.id})" title="Edit Note">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <!-- Delete Note trigger -->
            <button class="action-btn action-btn-delete" onclick="triggerDeleteNote(${note.id})" title="Delete Note">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Global binders for onclick handles inside injected HTML
window.triggerEditNote = function(id) {
  const note = notesCache.find(n => n.id == id);
  if (!note) return;
  
  activeEditId = id;
  editTitleInput.value = note.title;
  editContentInput.value = note.content;
  
  openModal();
};

window.triggerDeleteNote = function(id) {
  deleteNote(id);
};

// ==========================================
// 7. EVENT LISTENERS & FORM SUBMISSIONS
// ==========================================
function registerEventListeners() {
  // Add Note Form handleSubmit
  noteForm.addEventListener("submit", function(e) {
    e.preventDefault();
    
    const titleValue = noteTitleInput.value.trim();
    const contentValue = noteContentInput.value.trim();
    
    if (!titleValue || !contentValue) {
      showToast("Please enter both a title and some content content.", "error");
      return;
    }
    
    addNote(titleValue, contentValue);
    
    // Clear the form
    noteTitleInput.value = "";
    noteContentInput.value = "";
    noteTitleInput.focus();
  });

  // Edit Note Form handleSubmit inside Modal
  editForm.addEventListener("submit", function(e) {
    e.preventDefault();
    
    const updatedTitle = editTitleInput.value.trim();
    const updatedContent = editContentInput.value.trim();
    
    if (!updatedTitle || !updatedContent) {
      showToast("Notes require a title and some core content.", "error");
      return;
    }
    
    if (activeEditId !== null) {
      updateNote(activeEditId, updatedTitle, updatedContent);
    }
  });

  // Modal Closers
  closeModalBtn.addEventListener("click", closeModal);
  cancelModalBtn.addEventListener("click", closeModal);
  
  // Close modal when clicking gray background overlay
  editModal.addEventListener("click", function(e) {
    if (e.target === editModal) {
      closeModal();
    }
  });

  // Keyboard accessibility helper for modal (Escape key)
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && editModal.classList.contains("active")) {
      closeModal();
    }
  });

  // Layout Grid vs List control toggles
  gridViewBtn.addEventListener("click", () => toggleViewLayout("grid"));
  listViewBtn.addEventListener("click", () => toggleViewLayout("list"));
}

// ==========================================
// 8. LUXURIOUS UX HELPERS (MODALS, LAYOUTS, TOASTS)
// ==========================================

function openModal() {
  editModal.classList.add("active");
  editTitleInput.focus();
  document.body.style.overflow = "hidden"; // Prevent background scroll under active modal
}

function closeModal() {
  editModal.classList.remove("active");
  activeEditId = null;
  document.body.style.overflow = ""; // Re-enable background scrolling
}

// Switches dynamic layout structure and highlights selected button
function toggleViewLayout(layout) {
  currentLayout = layout;
  localStorage.setItem("supabase_notes_layout", layout);
  
  if (layout === "grid") {
    notesContainer.classList.add("grid-layout");
    gridViewBtn.classList.add("active");
    listViewBtn.classList.remove("active");
  } else {
    notesContainer.classList.remove("grid-layout");
    gridViewBtn.classList.remove("active");
    listViewBtn.classList.add("active");
  }
}

function loadViewPreferences() {
  const savedLayout = localStorage.getItem("supabase_notes_layout") || "grid";
  toggleViewLayout(savedLayout);
}

/**
 * Creates temporary system status messages to feedback state actions
 */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  
  // Slide out and remove toast after 4 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.4s ease-in-out";
    
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 4000);
}

// Helper to gracefully format Timestamps
function formatTimestamp(isoString) {
  if (!isoString) return "Just now";
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Recently";
    
    // Format options: "Jun 23, 2026, 06:15 AM"
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch (e) {
    return "Recently";
  }
}

// XSS Sanitizer: Escape HTML characters to prevent security injections
function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Dummy standard notes list to populate preview when totally blank
function getPlaceholderNotes() {
  return [
    {
      id: 1,
      title: "Welcome to your Notes Dashboard!",
      content: "This contains default starter material to showcase styling. Paste your real Supabase URL and Anon Key inside root file 'script.js' on lines 16 and 17 to immediately backup all data to Supabase Cloud!",
      created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },
    {
      id: 2,
      title: "Getting Started with Supabase Table schema",
      content: "Ensure your database contains a table named 'notes' with columns:\n- id (int8, primary key)\n- title (text)\n- content (text)\n- created_at (timestamp with time zone, default: now())\n\nHappy coding!",
      created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    }
  ];
}

// Run loader on DOM complete
document.addEventListener("DOMContentLoaded", init);
