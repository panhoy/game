
    document.addEventListener('DOMContentLoaded', function() {
        // --- Telegram Bot Configuration ---
        // !! IMPORTANT !!
        // Replace with YOUR actual backend server URL.
        // If running bot-server.js locally on default port 3000:
        const TELEGRAM_NOTIFY_URL = 'http://localhost:3000/notify';
        // If deployed (example): const TELEGRAM_NOTIFY_URL = 'https://your-app-name.herokuapp.com/notify';

        // !! IMPORTANT !!
        // Replace with YOUR Telegram Chat ID (get this from the bot using /mychatid).
        const TELEGRAM_CHAT_ID = '1732455712'; // <<< REPLACE THIS (use string for safety)

        // !! IMPORTANT !!
        // Replace with the SECRET KEY you set in bot-server.js (or leave as placeholder if not using one).
        const TELEGRAM_SECRET_KEY = '1732455712'; // <<< REPLACE THIS or remove if not needed


        // --- Elements ---
        const userForm = document.getElementById('user-form');
        const usernameInput = document.getElementById('username');
        const userList = document.getElementById('user-list');
        const userCheckboxList = document.getElementById('user-checkbox-list');
        const wheelCanvas = document.getElementById('wheel-canvas');
        const spinButton = document.getElementById('spin-wheel-btn');
        const selectAllBtn = document.getElementById('select-all-btn');
        const deselectAllBtn = document.getElementById('deselect-all-btn');
        const winnerDisplay = document.getElementById('winner-display');
        const historyList = document.getElementById('history-list');
        const clearHistoryBtn = document.getElementById('clear-history-btn');
        const usersCountSpan = document.getElementById('users-count');
        const spinsCountSpan = document.getElementById('spins-count');
        const timerDisplay = document.getElementById('timer-display');
        const themeToggleBtn = document.getElementById('theme-toggle');
        const importUsersBtn = document.getElementById('import-users-btn'); // Button moved inside HTML
        const importModal = document.getElementById('import-modal');
        const bulkImportText = document.getElementById('bulk-import-text');
        const confirmImportBtn = document.getElementById('confirm-import-btn');
        const cancelImportBtn = document.getElementById('cancel-import-btn');
        const exportHistoryBtn = document.getElementById('export-history-btn'); // Renamed for clarity
        const exportUsersBtn = document.getElementById('export-users-btn'); // New button for users

        // --- App State ---
        let users = []; // Stores user objects { name: string, weight: number }
        let selectedUsers = []; // Stores names (string) of users currently selected for the wheel
        let history = []; // Stores history log entries (string)
        let spinCount = 0;
        let isSpinning = false;
        let spinStartTime;
        let timerInterval;
        // More diverse colors
         let wheelColors = [
            '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
            '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3',
            '#808000', '#ffd8b1', '#000075', '#808080'
        ];
        const ctx = wheelCanvas.getContext('2d');
        const centerX = wheelCanvas.width / 2;
        const centerY = wheelCanvas.height / 2;
        let wheelRadius = (wheelCanvas.width / 2) - 5; // Padding from edge


        // --- Telegram Notification Function ---
        async function notifyTelegram(message) {
             // Simple validation: Check if URL and Chat ID seem like placeholders
             const isUrlPlaceholder = !TELEGRAM_NOTIFY_URL || TELEGRAM_NOTIFY_URL.includes('localhost') || TELEGRAM_NOTIFY_URL.includes('YOUR_BACKEND'); // Include localhost as potentially a placeholder during development
             const isChatIdPlaceholder = !TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === '1732455712' || TELEGRAM_CHAT_ID.toLowerCase().includes('your'); // Include the example ID

             if (isUrlPlaceholder || isChatIdPlaceholder) {
                 const warningMsg = "Telegram notification skipped: URL or Chat ID looks like a placeholder or example. Configure settings in the script.";
                 console.warn(warningMsg);
                 // Avoid flooding history with this warning. Maybe log it only once?
                 if (!window.telegramWarningLogged) {
                      addToHistory(`⚠️ ${warningMsg}`);
                      window.telegramWarningLogged = true;
                 }
                 return;
             }

            console.log(`Attempting to send Telegram notification: ${message}`);
            try {
                 const headers = {
                     'Content-Type': 'application/json',
                 };
                  // Only add Authorization header if a *non-placeholder* key is provided
                  const isSecretKeyReal = TELEGRAM_SECRET_KEY && TELEGRAM_SECRET_KEY !== '1732455712' && !TELEGRAM_SECRET_KEY.toLowerCase().includes('your');
                  if (isSecretKeyReal) {
                       headers['Authorization'] = `Bearer ${TELEGRAM_SECRET_KEY}`;
                  }

                const response = await fetch(TELEGRAM_NOTIFY_URL, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        chatId: TELEGRAM_CHAT_ID,
                        message: `🎡 Wheel: ${message}` // Add context
                    })
                });
                if (!response.ok) {
                    let errorText = 'Unknown error';
                     try {
                         errorText = await response.text();
                     } catch (_) { /* Ignore if reading text fails */ }
                    console.error(`Telegram notification failed: ${response.status} ${response.statusText}`, errorText);
                    addToHistory(`⚠️ TG Notify Fail (${response.status}): ${errorText.substring(0, 50)}...`); // Limit error length in history
                } else {
                    console.log('Telegram notification sent successfully.');
                     // Optionally add success to history for debugging? Usually not needed.
                     // addToHistory(`✅ TG Notify Sent`);
                }
            } catch (error) {
                console.error('Error sending Telegram notification request:', error);
                addToHistory(`⚠️ TG Notify Err: ${error.message}`);
            }
        }

        // --- Theme Toggling ---
        function applyTheme(theme) {
             document.documentElement.setAttribute('data-theme', theme);
             localStorage.setItem('wheelTheme', theme);
             // Trigger CSS transition - handled by .theme-transition class addition
             document.body.classList.add('theme-transition');
              // Remove the class after the transition duration (slightly longer than CSS duration)
              // This prevents the transition from running on every minor style change later
              setTimeout(() => document.body.classList.remove('theme-transition'), 600);

            drawWheel(); // Redraw wheel as colors might depend on theme vars
            updateModalTheme(); // Update modal if open
        }
         // Function to update modal styles based on current theme
         function updateModalTheme() {
              if (!importModal || importModal.style.display === 'none') return;

             const themeStyles = getComputedStyle(document.documentElement);
             const modalDiv = importModal.querySelector('div'); // Target inner div

              if(modalDiv) {
                  try { // Wrap DOM manipulations in try/catch for robustness
                       modalDiv.style.backgroundColor = themeStyles.getPropertyValue('--bg-card').trim();
                       modalDiv.style.color = themeStyles.getPropertyValue('--text-primary').trim();
                       modalDiv.style.boxShadow = themeStyles.getPropertyValue('--shadow-lg').trim(); // Use larger shadow

                       bulkImportText.style.backgroundColor = themeStyles.getPropertyValue('--bg-secondary').trim(); // Use secondary bg
                       bulkImportText.style.color = themeStyles.getPropertyValue('--text-primary').trim();
                       bulkImportText.style.borderColor = themeStyles.getPropertyValue('--border-color').trim();

                       cancelImportBtn.style.background = themeStyles.getPropertyValue('--bg-secondary').trim(); // Use secondary bg
                       cancelImportBtn.style.color = themeStyles.getPropertyValue('--text-secondary').trim(); // Use secondary text

                       confirmImportBtn.style.background = `linear-gradient(145deg, ${themeStyles.getPropertyValue('--primary-color').trim()}, ${themeStyles.getPropertyValue('--primary-dark').trim()})`;
                       confirmImportBtn.style.color = 'white'; // Ensure white text
                  } catch (e) {
                       console.error("Error applying theme to modal:", e);
                  }
              }
          }


        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            applyTheme(currentTheme === 'light' ? 'dark' : 'light');
        });

        // --- Local Storage ---
        function loadFromLocalStorage() {
            console.log("Loading data from localStorage...");
            try {
                const savedUsers = localStorage.getItem('wheelUsers');
                const savedHistory = localStorage.getItem('wheelHistory');
                const savedSpinCount = localStorage.getItem('wheelSpinCount');
                const savedSelectedUsers = localStorage.getItem('wheelSelectedUsers'); // Load selected state

                if (savedUsers) {
                    // Ensure backward compatibility and correct structure/types
                     const parsedUsers = JSON.parse(savedUsers);
                     users = parsedUsers.map(u => {
                         if (typeof u === 'string') {
                             // Convert old string format to new object format
                             return { name: u, weight: 1 };
                         } else if (typeof u === 'object' && u.name) {
                              // Ensure weight is a number >= 1
                              const weight = parseInt(u.weight || 1);
                              return { name: String(u.name), weight: Math.max(1, weight || 1) };
                          }
                          return null; // Invalid user entry
                     }).filter(u => u !== null); // Remove invalid entries
                     console.log(`Loaded ${users.length} users.`);
                } else {
                    users = [];
                    console.log("No saved users found.");
                }

                 if (savedSelectedUsers) {
                    // Load previously selected users
                    selectedUsers = JSON.parse(savedSelectedUsers);
                    console.log(`Loaded ${selectedUsers.length} selected users.`);
                    // Validate that loaded selected users still exist in the main user list
                     selectedUsers = selectedUsers.filter(selectedName => users.some(u => u.name === selectedName));
                     console.log(`Validated ${selectedUsers.length} selected users still exist.`);
                 } else {
                      // Default: select all loaded users
                      selectedUsers = users.map(u => u.name);
                      console.log("No saved selection found, selecting all users by default.");
                 }

                if (savedHistory) {
                    history = JSON.parse(savedHistory);
                     // Basic validation: ensure it's an array of strings
                     if (!Array.isArray(history) || !history.every(item => typeof item === 'string')) {
                          console.warn("Invalid history format found, resetting history.");
                          history = [];
                     }
                    console.log(`Loaded ${history.length} history entries.`);
                } else {
                    history = [];
                    console.log("No saved history found.");
                }

                if (savedSpinCount) {
                    spinCount = parseInt(savedSpinCount) || 0;
                    spinsCountSpan.textContent = `Total Spins: ${spinCount}`;
                    console.log(`Loaded spin count: ${spinCount}`);
                } else {
                     spinCount = 0; // Reset spin count if not found
                     spinsCountSpan.textContent = `Total Spins: 0`;
                     console.log("No saved spin count found.");
                 }
                // Avoid adding history message on load
            } catch (error) {
                console.error('Error loading data from localStorage:', error);
                 // Clear potentially corrupted data and reset state
                 localStorage.removeItem('wheelUsers');
                 localStorage.removeItem('wheelSelectedUsers');
                 localStorage.removeItem('wheelHistory');
                 localStorage.removeItem('wheelSpinCount');
                 users = []; selectedUsers = []; history = []; spinCount = 0;
                 spinsCountSpan.textContent = `Total Spins: 0`;
                 // Notify user about the reset? Could be annoying. Log is enough.
                 addToHistory("⚠️ Error loading saved data, state reset.");
            } finally {
                 // Update UI regardless of load success/failure
                 updateUsersList(); // This updates both lists and the wheel
                 updateHistoryList();
                 updateSpinButtonState(); // Ensure button state is correct after load
                 console.log("Initial UI updated after loading data.");
            }
        }

        function saveToLocalStorage() {
            console.log("Saving data to localStorage...");
            try {
                localStorage.setItem('wheelUsers', JSON.stringify(users));
                localStorage.setItem('wheelSelectedUsers', JSON.stringify(selectedUsers)); // Save selected state
                localStorage.setItem('wheelHistory', JSON.stringify(history));
                localStorage.setItem('wheelSpinCount', spinCount.toString());
                console.log("Data saved successfully.");
            } catch (error) {
                console.error('Error saving to localStorage:', error);
                // Maybe notify user if storage is full?
                if (error.name === 'QuotaExceededError') {
                     alert("Error: Could not save data. Browser storage might be full. Please export your data and consider clearing history or removing users.");
                     addToHistory("⚠️ Failed to save data (Storage Full?). Export recommended.");
                     notifyTelegram("⚠️ Failed to save data to browser storage (QuotaExceededError).");
                } else {
                     addToHistory("⚠️ Error saving data to browser storage.");
                     notifyTelegram("⚠️ Error saving data to browser storage.");
                }
            }
        }

        // --- Bulk User Import ---
        importUsersBtn.addEventListener('click', () => {
            importModal.style.display = 'flex'; // Make container visible first
             requestAnimationFrame(() => { // Allow display:flex to apply before adding class
                 importModal.classList.add('visible'); // Trigger transition
             });
            updateModalTheme(); // Apply correct theme styles to modal
            bulkImportText.value = ''; // Clear previous input
            bulkImportText.focus(); // Focus textarea
        });

        function closeModal() {
             importModal.classList.remove('visible'); // Start fade out
              // Wait for animation to finish before setting display:none
              setTimeout(() => {
                   importModal.style.display = 'none';
              }, 300); // Match transition duration
        }

        cancelImportBtn.addEventListener('click', closeModal);
         // Close modal if backdrop is clicked
         importModal.addEventListener('click', (e) => {
              // Check if the click was directly on the modal backdrop (not the inner div)
              if (e.target === importModal) {
                   closeModal();
              }
         });


        confirmImportBtn.addEventListener('click', () => {
            const text = bulkImportText.value.trim();
            if (!text) {
                closeModal(); // Close if empty
                return;
            }
            // Split by newline or comma, trim whitespace, filter out empty strings
            const names = text.split(/[\n,]+/)
                             .map(name => name.trim())
                             .filter(name => name.length > 0);

            let addedCount = 0, duplicateCount = 0;
            const addedNamesForHistory = [];

            names.forEach(name => {
                // Case-insensitive check for existence
                 const nameLower = name.toLowerCase();
                const exists = users.some(u => u.name.toLowerCase() === nameLower);
                if (!exists) {
                    users.push({ name: name, weight: 1 }); // Add as object with default weight
                    selectedUsers.push(name); // Auto-select new users
                    addedCount++;
                    addedNamesForHistory.push(name);
                } else {
                    duplicateCount++;
                }
            });

            if (addedCount > 0) {
                updateUsersList(); // Update UI
                let historyMsg = `Imported ${addedCount} user(s)${addedCount < 10 ? ': ' + addedNamesForHistory.join(', ') : ''}${duplicateCount > 0 ? ` (skipped ${duplicateCount} duplicate(s))` : ''}.`;
                addToHistory(historyMsg);
                notifyTelegram(`➕ ${historyMsg}`); // Notify Telegram
                saveToLocalStorage();
            } else if (duplicateCount > 0) {
                 const skipMsg = `Import skipped ${duplicateCount} duplicate name(s). No new users added.`;
                addToHistory(skipMsg);
                 // Maybe notify only if NO users were added?
                 // notifyTelegram(`⚠️ ${skipMsg}`);
                 alert(skipMsg); // Inform user via alert if only duplicates found
            }
            closeModal(); // Close modal after processing
        });

        // --- Winner Animation & Sound ---
         function celebrateWinner(winner) {
             console.log(`Celebrating winner: ${winner}`);
             // Sound Effect
             try {
                 const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                 if (!audioContext) { throw new Error("AudioContext not supported."); }

                  // Improved sound sequence
                  function playNote(frequency, duration, delay = 0, type = 'sine', volume = 0.2) {
                       const oscillator = audioContext.createOscillator();
                       const gainNode = audioContext.createGain();

                       oscillator.type = type;
                       oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);

                       gainNode.gain.setValueAtTime(volume, audioContext.currentTime + delay);
                       // Fade out quickly
                       gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + duration);

                       oscillator.connect(gainNode);
                       gainNode.connect(audioContext.destination);

                       oscillator.start(audioContext.currentTime + delay);
                       oscillator.stop(audioContext.currentTime + delay + duration);
                   }
                   // Simple ascending arpeggio
                   playNote(523.25, 0.12, 0, 'triangle'); // C5
                   playNote(659.25, 0.12, 0.1, 'triangle'); // E5
                   playNote(783.99, 0.12, 0.2, 'triangle'); // G5
                   playNote(1046.50, 0.25, 0.3, 'sine');   // C6 (longer)

             } catch (error) {
                  console.warn("Could not play celebration sound:", error);
             }

             // Confetti Effect
             const confettiCount = 120; // More confetti!
             const container = document.body;
             const wheelRect = wheelCanvas.getBoundingClientRect();
              // Start slightly offset from exact center for a better spread
              const startX = wheelRect.left + wheelRect.width / 2 + (Math.random() - 0.5) * 20;
              const startY = wheelRect.top + wheelRect.height / 2 + (Math.random() - 0.5) * 20;


              for (let i = 0; i < confettiCount; i++) {
                  const confetti = document.createElement('div');
                  confetti.className = 'confetti'; // Add class for animation base

                   const size = 8 + Math.random() * 8; // Vary size
                  confetti.style.width = `${size}px`;
                  confetti.style.height = `${size * (0.6 + Math.random() * 0.4)}px`; // Vary aspect ratio
                  confetti.style.backgroundColor = wheelColors[Math.floor(Math.random() * wheelColors.length)];
                  confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '3px'; // Mix shapes

                  confetti.style.left = `${startX}px`;
                  confetti.style.top = `${startY}px`;

                   const angle = Math.random() * Math.PI * 2; // Random direction
                   const distance = 150 + Math.random() * 400; // Vary distance
                   // Apply physics-like effect (more vertical movement initially)
                   const endX = Math.cos(angle) * distance * (0.5 + Math.random() * 0.5); // Less horizontal spread initially
                   const endY = Math.sin(angle) * distance * (0.8 + Math.random() * 0.4) + (window.innerHeight - startY) * 0.8; // Move mostly downwards
                   const rotation = Math.random() * 1080 - 540; // More rotation
                   const duration = 2000 + Math.random() * 3000; // Longer duration variance
                   const delay = Math.random() * 300; // Stagger start times

                   // Using Web Animations API for performance
                   const animation = confetti.animate([
                       // Initial state (slight outward push before main animation)
                       { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
                       // Mid-point (optional - for trajectory shaping)
                       // { transform: `translate(${endX * 0.3}px, ${endY * 0.4}px) rotate(${rotation * 0.3}deg)`, opacity: 0.9 },
                       // Final state
                       { transform: `translate(${endX}px, ${endY}px) rotate(${rotation}deg)`, opacity: 0 }
                   ], {
                       duration: duration,
                       easing: 'cubic-bezier(0.1, 0.9, 0.2, 1.0)', // Custom easing for a nice fall
                       delay: delay,
                       fill: 'forwards' // Keep final state (opacity 0)
                   });

                  container.appendChild(confetti); // Add to body *after* defining animation

                  // Clean up the DOM element after animation completes
                   animation.onfinish = () => confetti.remove();
              }
          }


        // --- User Management & Weights ---
         function updateUsersList() {
             console.log("Updating user lists and wheel...");
             const fragment = document.createDocumentFragment();
             const checkboxFragment = document.createDocumentFragment();
             // Clear existing lists faster using innerHTML = ''
             userList.innerHTML = '';
             userCheckboxList.innerHTML = '';
             // Add ARIA busy state while updating? (Consider for larger lists)
             // userList.setAttribute('aria-busy', 'true');
             // userCheckboxList.setAttribute('aria-busy', 'true');


             if (users.length === 0) {
                 userList.innerHTML = '<li class="empty-list-message" role="listitem">No users added yet.</li>';
                 userCheckboxList.innerHTML = '<div class="empty-list-message">No users available.</div>';
             } else {
                 users.forEach((user, index) => {
                      // user object: { name: string, weight: number }
                      const { name: userName, weight: userWeight } = user; // Destructure for clarity
                      const isSelected = selectedUsers.includes(userName);
                      const uniqueLiId = `user-mgmt-${index}`; // Unique ID for ARIA relationship
                      const uniqueCbId = `user-cb-${index}`;
                      const uniqueLabelId = `user-label-${index}`;

                      // User Management List Item (using template literals for readability)
                      const li = document.createElement('li');
                       li.setAttribute('role', 'listitem');
                       li.id = uniqueLiId;
                       li.innerHTML = `
                           <span style="flex-grow: 1; word-break: break-all; margin-right: 10px;" id="${uniqueLiId}-name">${userName}</span>
                           <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                               <div class="weight-control" data-tooltip="Adjust chance weight for ${userName}">
                                   <button class="weight-btn weight-decrease action-btn" data-index="${index}" aria-label="Decrease weight for ${userName}" aria-controls="${uniqueLiId}-weight ${uniqueLiId}-name">-</button>
                                   <span class="weight-display" id="${uniqueLiId}-weight" data-index="${index}" aria-live="polite" aria-atomic="true" aria-label="Current weight for ${userName}">${userWeight}x</span>
                                   <button class="weight-btn weight-increase action-btn" data-index="${index}" aria-label="Increase weight for ${userName}" aria-controls="${uniqueLiId}-weight ${uniqueLiId}-name">+</button>
                               </div>
                               <button class="delete-btn action-btn" data-index="${index}" aria-label="Remove ${userName}" aria-controls="${uniqueLiId}">Remove</button>
                           </div>`;
                       fragment.appendChild(li);

                      // Participant Selection Checkbox Item
                      const div = document.createElement('div');
                       div.className = 'checkbox-item';
                       div.setAttribute('role', 'listitem'); // Role within the group
                       div.innerHTML = `
                           <input type="checkbox" id="${uniqueCbId}" value="${userName}" ${isSelected ? 'checked' : ''} aria-labelledby="${uniqueLabelId}">
                           <label for="${uniqueCbId}" id="${uniqueLabelId}" style="word-break: break-all;">${userName}</label>`;
                       checkboxFragment.appendChild(div);
                 });
                 userList.appendChild(fragment);
                 userCheckboxList.appendChild(checkboxFragment);

                  // Attach listeners AFTER adding elements to the DOM for efficiency
                  attachUserListListeners();
                  attachCheckboxListeners();
             }
              // Reset ARIA busy state
              // userList.removeAttribute('aria-busy');
              // userCheckboxList.removeAttribute('aria-busy');

              // Update count and wheel
              usersCountSpan.textContent = `Total Users: ${users.length}`;
              drawWheel(); // Redraw the wheel based on *selected* users
              updateSpinButtonState(); // Update button enable/disable state
             console.log("User lists and wheel updated.");
         }


         function attachUserListListeners() {
            // Use event delegation on the user list for better performance, especially with many users
             userList.addEventListener('click', function(e) {
                  const target = e.target; // The element that was actually clicked

                  // Find the closest button ancestor with the target classes
                  const deleteButton = target.closest('.delete-btn');
                  const decreaseButton = target.closest('.weight-decrease');
                  const increaseButton = target.closest('.weight-increase');

                  if (deleteButton && deleteButton.dataset.index !== undefined) {
                       removeUser(parseInt(deleteButton.dataset.index));
                       return; // Handled
                  }
                  if (decreaseButton && decreaseButton.dataset.index !== undefined) {
                       changeUserWeight(parseInt(decreaseButton.dataset.index), -1);
                       return; // Handled
                   }
                  if (increaseButton && increaseButton.dataset.index !== undefined) {
                       changeUserWeight(parseInt(increaseButton.dataset.index), 1);
                       return; // Handled
                   }
             });
         }


        function attachCheckboxListeners() {
            // Use event delegation for checkboxes as well
            userCheckboxList.addEventListener('change', function(e) {
                 if (e.target && e.target.matches('input[type="checkbox"]')) {
                     // Wait a fraction of a second to allow multiple quick changes
                     // This debounce prevents excessive redraws/saves if user clicks rapidly
                      clearTimeout(window.checkboxUpdateTimeout);
                      window.checkboxUpdateTimeout = setTimeout(() => {
                           updateSelectedUsers();
                           saveToLocalStorage(); // Save selection changes
                      }, 100); // 100ms delay
                 }
            });
        }

        function changeUserWeight(index, change) {
             if (index < 0 || index >= users.length) return; // Bounds check

             const user = users[index];
             const oldWeight = user.weight; // Already an object
             let newWeight = Math.max(1, oldWeight + change); // Ensure weight is at least 1

             if (oldWeight === newWeight) return; // No change needed

             users[index].weight = newWeight; // Update weight in the main users array

             // Update the visual display using more specific selector
              const weightDisplay = userList.querySelector(`#user-mgmt-${index}-weight`);
             if (weightDisplay) {
                  weightDisplay.textContent = `${newWeight}x`;
             } else {
                  console.warn(`Could not find weight display for index ${index}`);
              }


             const historyMsg = `Adjusted weight for ${user.name} from ${oldWeight}x to ${newWeight}x`;
             addToHistory(historyMsg);
             notifyTelegram(`⚖️ ${historyMsg}.`);
             drawWheel(); // Redraw needed as weights affect segment calculation
             saveToLocalStorage(); // Save changes
             updateSpinButtonState(); // Weights affect eligibility potentially (if all weight 1 needed >1 users)
         }


        function addUser(username) {
            username = username.trim();
            if (!username) {
                usernameInput.focus(); // Focus if empty
                return;
            }
             // Case-insensitive check
            const nameLower = username.toLowerCase();
            const exists = users.some(u => u.name.toLowerCase() === nameLower);

            if (!exists) {
                users.push({ name: username, weight: 1 }); // Add new user object
                selectedUsers.push(username); // Auto-select the new user
                updateUsersList(); // Update UI
                const historyMsg = `Added user: ${username}`;
                addToHistory(historyMsg);
                notifyTelegram(`➕ ${historyMsg}.`);
                saveToLocalStorage(); // Save changes
            } else {
                 // Visually indicate the duplicate entry? Highlight existing?
                 // For now, alert and select the input.
                alert(`User "${username}" already exists.`);
                const existingUserIndex = users.findIndex(u => u.name.toLowerCase() === nameLower);
                 if (existingUserIndex > -1) {
                      const existingElement = userList.querySelector(`#user-mgmt-${existingUserIndex}`);
                      if (existingElement) {
                          existingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          // Add a temporary highlight?
                           existingElement.style.transition = 'background-color 0.5s ease';
                           existingElement.style.backgroundColor = 'rgba(255, 255, 0, 0.3)'; // Yellow highlight
                           setTimeout(() => {
                                if(existingElement) existingElement.style.backgroundColor = '';
                           }, 1500);
                       }
                  }
                usernameInput.focus(); usernameInput.select();
            }
        }

        function removeUser(index) {
            if (index < 0 || index >= users.length) return;

            const removedUser = users[index]; // Get user object before removing
            const userName = removedUser.name;

             // Confirmation dialog
             if (!confirm(`Are you sure you want to remove "${userName}"?`)) {
                  return; // User cancelled
              }


            users.splice(index, 1); // Remove from main users array
            selectedUsers = selectedUsers.filter(name => name !== userName); // Remove from selection if present

            updateUsersList(); // Update UI (this re-indexes everything)

            const historyMsg = `Removed user: ${userName}`;
            addToHistory(historyMsg);
            notifyTelegram(`➖ ${historyMsg}.`);
            saveToLocalStorage(); // Save changes
        }

        function updateSelectedUsers() {
            selectedUsers = Array.from(userCheckboxList.querySelectorAll('input[type="checkbox"]:checked'))
                                 .map(cb => cb.value);
            console.log('Selected users updated:', selectedUsers);
            drawWheel(); // Redraw wheel based on new selection
            updateSpinButtonState(); // Check if spin is possible
            // Note: Saving is debounced in the event listener to avoid saving on every single click
        }

        // --- Wheel Drawing & Spinning ---

        function getWheelEntriesAndColors() {
             const entries = [];
             const entryColors = [];
             const segmentMap = new Map(); // Track unique names and their assigned colors

             selectedUsers.forEach(name => {
                  const userEntry = users.find(u => u.name === name);
                  if (userEntry) {
                       const weight = userEntry.weight; // Should always be >= 1
                       if (!segmentMap.has(name)) {
                           // Assign color cyclically only to unique selected names
                           const colorIndex = segmentMap.size % wheelColors.length;
                            segmentMap.set(name, wheelColors[colorIndex]);
                       }
                       const assignedColor = segmentMap.get(name);
                       for (let i = 0; i < weight; i++) {
                            entries.push(name); // Add name 'weight' times
                            entryColors.push(assignedColor); // Add corresponding color 'weight' times
                       }
                  }
              });
              // Shuffle entries to distribute weights visually? (Optional but often desired)
             // Simple Fisher-Yates shuffle
             for (let i = entries.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [entries[i], entries[j]] = [entries[j], entries[i]]; // Swap name
                  [entryColors[i], entryColors[j]] = [entryColors[j], entryColors[i]]; // Swap color consistently
             }


             return { wheelEntries: entries, wheelEntryColors: entryColors };
         }


        function drawWheel(currentAngle = 0) { // Optional angle for drawing during spin
             // Clear and setup context
             ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
             ctx.save();
             ctx.translate(centerX, centerY);
             ctx.rotate(currentAngle); // Rotate canvas for spin effect or final position
             ctx.translate(-centerX, -centerY); // Translate back

             // Get entries based on current selection and weights
             const { wheelEntries, wheelEntryColors } = getWheelEntriesAndColors();


             // Handle empty wheel state
             if (wheelEntries.length === 0) {
                  ctx.beginPath();
                  ctx.arc(centerX, centerY, wheelRadius, 0, Math.PI * 2);
                  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#e0eafc';
                  ctx.fill();
                  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#a9b4c8';
                  ctx.font = 'bold 16px var(--font-primary)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                  const message = users.length === 0 ? 'Add users first' : 'Select participants';
                   // Wrap text if necessary
                  const maxWidth = wheelRadius * 1.5;
                  wrapText(ctx, message, centerX, centerY, maxWidth, 20);

                 ctx.restore(); // Restore context before returning
                 return;
             }

             // Draw wheel segments
             const sliceAngle = (Math.PI * 2) / wheelEntries.length;
             const textRadius = wheelRadius * 0.8; // Position text further in
             const maxTextWidth = wheelRadius * 0.6; // Limit text width more strictly


             wheelEntries.forEach((name, index) => {
                  const startAngle = index * sliceAngle;
                  const endAngle = startAngle + sliceAngle;

                  // Draw segment
                  ctx.beginPath();
                  ctx.moveTo(centerX, centerY);
                  ctx.arc(centerX, centerY, wheelRadius, startAngle, endAngle);
                  ctx.closePath();
                  ctx.fillStyle = wheelEntryColors[index] || '#cccccc'; // Use calculated color, fallback grey
                  ctx.fill();

                 // Add subtle border between segments (optional)
                 ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
                 ctx.lineWidth = 1.5;
                 ctx.stroke();


                  // Draw text for the segment
                  ctx.save(); // Save context for each text element
                  ctx.translate(centerX, centerY); // Move origin to center
                  const textAngle = startAngle + sliceAngle / 2; // Middle of the segment
                  ctx.rotate(textAngle); // Rotate for text alignment

                  // Text properties
                  ctx.textAlign = 'right';
                   ctx.textBaseline = 'middle';
                   // Determine text color based on background brightness (basic contrast check)
                   ctx.fillStyle = getContrastColor(ctx.fillStyle);
                  // Adjust font size dynamically (more robust)
                   let fontSize = Math.min(16, Math.max(8, wheelRadius / 8)); // Base size on radius
                   ctx.font = `bold ${fontSize}px var(--font-primary)`;
                   let metrics = ctx.measureText(name);
                    // Reduce font size if text overflows
                    while (metrics.width > maxTextWidth && fontSize > 8) {
                         fontSize -= 1;
                         ctx.font = `bold ${fontSize}px var(--font-primary)`;
                         metrics = ctx.measureText(name);
                    }
                     // Truncate text if still too long (even at min font size)
                     let displayName = name;
                     if (metrics.width > maxTextWidth) {
                         let charEstimate = Math.floor(name.length * (maxTextWidth / metrics.width)) - 1;
                          displayName = name.substring(0, Math.max(1, charEstimate)) + '…';
                     }

                  ctx.fillText(displayName, textRadius, 0); // Draw text along the radius
                  ctx.restore(); // Restore context rotation/translation
              });

             // Draw outer border (optional aesthetic)
             ctx.beginPath();
             ctx.arc(centerX, centerY, wheelRadius, 0, Math.PI * 2);
             ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim() || '#3b56e0'; // Use theme color
             ctx.lineWidth = 4;
             ctx.stroke();

              // Draw center circle (hub) - enhance appearance
              ctx.beginPath();
              ctx.arc(centerX, centerY, wheelRadius * 0.15, 0, Math.PI * 2); // Relative size
              ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#ffffff'; // Match card background
              ctx.fill();
              ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#4e6bff';
              ctx.lineWidth = 3;
              ctx.stroke();


             ctx.restore(); // Restore initial canvas state
         }


         // Helper function for text contrast
          function getContrastColor(hexColor) {
             // Simple brightness check - assumes hex format like #RRGGBB
             try {
                 if (hexColor.startsWith('rgb')) { // Handle rgb() format from getComputedStyle if needed
                      const rgb = hexColor.match(/\d+/g).map(Number);
                      const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
                      return luminance > 0.5 ? (document.documentElement.getAttribute('data-theme') === 'dark' ? '#111' : '#333') : '#f0f0f0';
                 }
                  if (!hexColor || hexColor.length < 7) return getComputedStyle(document.documentElement).getPropertyValue('--text-light').trim(); // Fallback

                  const r = parseInt(hexColor.substring(1, 3), 16);
                  const g = parseInt(hexColor.substring(3, 5), 16);
                  const b = parseInt(hexColor.substring(5, 7), 16);
                  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                   // Adjust threshold slightly for better dark theme compatibility
                  return luminance > 0.55 ? (document.documentElement.getAttribute('data-theme') === 'dark' ? '#1a1c2d' : '#2c3e50') : '#ffffff';
             } catch (e) {
                  console.warn("Error determining contrast color for", hexColor, e);
                  return '#ffffff'; // Default light text on error
              }
          }


         // Helper function for wrapping text on canvas
          function wrapText(context, text, x, y, maxWidth, lineHeight) {
               const words = text.split(' ');
               let line = '';
               let currentY = y - (lineHeight * (words.length > 1 ? 0.5 : 0)); // Adjust start Y for multi-line

              for (let n = 0; n < words.length; n++) {
                  const testLine = line + words[n] + ' ';
                  const metrics = context.measureText(testLine);
                  const testWidth = metrics.width;
                  if (testWidth > maxWidth && n > 0) {
                       context.fillText(line, x, currentY);
                       line = words[n] + ' ';
                       currentY += lineHeight;
                  } else {
                       line = testLine;
                   }
              }
              context.fillText(line, x, currentY);
          }

        let currentRotation = 0; // Store the wheel's visual rotation state

        function spinWheel() {
            const { wheelEntries } = getWheelEntriesAndColors(); // Only need entries length here

            if (wheelEntries.length < 2) { // Require at least 2 entries (not just users)
                alert("Please select at least two participants (or add weight) to spin the wheel.");
                return;
            }
            if (isSpinning) return; // Prevent multi-spins

            isSpinning = true;
            updateSpinButtonState(); // Disable button
            winnerDisplay.textContent = '\u00A0'; // Clear previous winner (use non-breaking space for layout)
            winnerDisplay.classList.remove('winner-highlight');
            startTimer(); // Start spin timer display
             spinStartTime = Date.now(); // Record actual spin start time

            const baseRevolutions = 4 + Math.random() * 2; // Fewer base revolutions for slightly faster feel
             const randomVariation = Math.random() * (Math.PI * 2); // Add random offset less than a full circle
             const totalRotation = (baseRevolutions * (Math.PI * 2)) + randomVariation;
             const spinDuration = 4500 + Math.random() * 2500; // Adjust duration range


            const startAngle = currentRotation; // Start animation from current visual rotation
            const targetAngle = startAngle + totalRotation; // Calculate final absolute angle

            notifyTelegram(`🎬 Spin started with ${wheelEntries.length} weighted entries.`);
            console.log(`Spin details: Duration=${(spinDuration / 1000).toFixed(1)}s, Revolutions~=${(totalRotation / (Math.PI*2)).toFixed(1)}`);


             let animationFrameId; // Store request ID to potentially cancel if needed

            function easeOutCubic(t) { return (--t) * t * t + 1; } // Easing function (starts fast, slows down)

             const animationStartTime = performance.now();

             function rotateStep(timestamp) {
                 const elapsed = timestamp - animationStartTime;
                 const progress = Math.min(elapsed / spinDuration, 1); // Normalized time (0 to 1)
                 const easedProgress = easeOutCubic(progress); // Apply easing

                 // Calculate the interpolated angle between start and target
                 currentRotation = startAngle + (targetAngle - startAngle) * easedProgress;

                 drawWheel(currentRotation); // Redraw the wheel at the new angle

                 if (progress < 1) {
                      animationFrameId = requestAnimationFrame(rotateStep); // Continue animation
                 } else {
                     // Ensure final position is drawn exactly
                     drawWheel(currentRotation); // Use the final calculated currentRotation
                     endSpin(currentRotation); // Pass the final rotation angle
                      isSpinning = false; // Animation finished
                      updateSpinButtonState();
                 }
            }

            // Cancel any previous frame before starting a new one
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(rotateStep);
        }


        function endSpin(finalAngle) {
            stopTimer(); // Stop and display final duration
             console.log(`Spin ended at angle: ${finalAngle.toFixed(2)} radians`);


            const { wheelEntries } = getWheelEntriesAndColors(); // Get potentially shuffled entries
            if (wheelEntries.length === 0) return; // Should not happen if spin started, but safe check

            const sliceAngle = (Math.PI * 2) / wheelEntries.length; // Angle per segment

            // Calculate the angle relative to the *top pointer* (which is at -PI/2 or 1.5*PI visually).
             // The finalAngle represents the canvas rotation. We need to find which segment lands *under* the top pointer.
             // Normalize the angle to be within [0, 2*PI). Adding 2*PI ensures positive result after modulo.
             const normalizedAngle = (finalAngle % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2);

             // Determine the 'winning segment' index. The pointer points upwards (-PI/2).
             // The wheel rotates clockwise. An angle of 0 means the start of the first segment is at 3 o'clock.
             // The segment under the pointer is the one whose start angle is slightly *after* 1.5*PI (or -PI/2)
             // when considering the rotation direction.
             // Easier: Find the segment whose *range* contains the pointer angle (1.5*PI).
             // Convert the final rotation angle to the angle *at the pointer*.
             const angleAtPointer = ((Math.PI * 2) - normalizedAngle + (1.5 * Math.PI)) % (Math.PI * 2);


            // The winning index is the floor of the pointer angle divided by the segment angle.
            let winnerIndex = Math.floor(angleAtPointer / sliceAngle);


            // Boundary checks (should theoretically not be needed with correct modulo)
            winnerIndex = Math.max(0, Math.min(winnerIndex, wheelEntries.length - 1));

             if (winnerIndex >= wheelEntries.length || winnerIndex < 0) {
                 console.error("Calculated invalid winner index:", winnerIndex, "Entries:", wheelEntries.length);
                 winnerIndex = 0; // Fallback to first entry
             }


             const winner = wheelEntries[winnerIndex];

             console.log(`Calculated winner: ${winner} at index ${winnerIndex}`);

            // --- Update UI & State ---
            winnerDisplay.textContent = `Winner: ${winner}!`;
            winnerDisplay.classList.add('winner-highlight');
             // Accessibility: Announce winner clearly
             const winnerAnnounceSpan = winnerDisplay.querySelector('.visually-hidden');
             if(winnerAnnounceSpan) winnerAnnounceSpan.textContent = `The winner is ${winner}`;

             celebrateWinner(winner);

             spinCount++; // Increment spin count *after* successful spin
             spinsCountSpan.textContent = `Total Spins: ${spinCount}`;

             const historyMsg = `Spin #${spinCount}: ${winner} won! (from ${selectedUsers.length} selected)`;
             addToHistory(historyMsg);
             notifyTelegram(`🎉 ${historyMsg}`);
             saveToLocalStorage(); // Save spin count, history
             updateSpinButtonState(); // Re-enable button if conditions met

              // Maybe deselect the winner automatically? (Optional feature)
              // if (confirm(`Congratulation ${winner}!\n\nRemove ${winner} from the next spin?`)) {
              //     const checkbox = userCheckboxList.querySelector(`input[value="${CSS.escape(winner)}"]`);
              //     if (checkbox) checkbox.checked = false;
              //     updateSelectedUsers();
              //     saveToLocalStorage();
              //     addToHistory(`${winner} automatically deselected.`);
              //     notifyTelegram(`☑️ ${winner} auto-deselected.`);
              // }

         }


        // --- Timer ---
         function startTimer() {
              clearInterval(timerInterval); // Clear any existing timer
              let startTime = Date.now();
              timerDisplay.textContent = 'Spin Duration: 0.0s'; // Reset display

              timerInterval = setInterval(() => {
                   if (!isSpinning) { // Stop updating if spin ended early somehow
                        clearInterval(timerInterval);
                        return;
                   }
                   const elapsed = ((Date.now() - startTime) / 1000);
                   timerDisplay.textContent = `Spin Duration: ${elapsed.toFixed(1)}s`;
              }, 100); // Update every 100ms
          }

          function stopTimer() {
               clearInterval(timerInterval); // Stop the interval
               if(spinStartTime){ // Ensure spinStartTime was set
                    const finalDuration = ((Date.now() - spinStartTime) / 1000).toFixed(1);
                    timerDisplay.textContent = `Spin Duration: ${finalDuration}s`;
                    console.log(`Final Spin Duration: ${finalDuration}s`);
               } else {
                    timerDisplay.textContent = `Spin Duration: ---s`; // Indicate error or no spin
                }
               spinStartTime = null; // Reset for next spin
           }

        // --- History & Utility ---
         function addToHistory(message) {
            // Limit history length before adding new entry
             const maxHistoryLength = 100;
             if (history.length >= maxHistoryLength) {
                 history = history.slice(0, maxHistoryLength - 1); // Keep newest, remove oldest
             }

             const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
             history.unshift(`[${timestamp}] ${message}`); // Add to the beginning
             updateHistoryList(); // Update UI
             // Saving to localStorage is usually done after the action causing history entry
         }


        function updateHistoryList() {
             if (!historyList) return; // Safety check

             if (history.length === 0) {
                  historyList.innerHTML = '<li class="empty-list-message">No history yet.</li>';
             } else {
                  // Optimize rendering: Build string or use fragment
                  const fragment = document.createDocumentFragment();
                  history.forEach(entry => {
                      const li = document.createElement('li');
                       // Sanitize potentially unsafe content if necessary, though typically system messages are safe
                       // For user-generated content in history, sanitization would be crucial
                       li.textContent = entry;
                       li.setAttribute('role', 'logentry'); // Better semantics for a log
                      fragment.appendChild(li);
                  });
                  historyList.innerHTML = ''; // Clear previous entries efficiently
                  historyList.appendChild(fragment);
              }
          }


        function updateSpinButtonState() {
            // Need at least 2 *weighted entries* (not just selected users) to spin meaningfully.
            // Exception: if only one user is selected but has weight > 1, spinning is technically
            // possible but pointless. Let's require at least two unique selected users OR
            // at least one selected user with weight > 1 resulting in multiple entries.
            // Simpler rule: Require at least 2 weighted entries total.

            const { wheelEntries } = getWheelEntriesAndColors();
            const canSpin = wheelEntries.length >= 2 && !isSpinning;
             spinButton.disabled = !canSpin;

             // Update tooltip based on state
              if (isSpinning) {
                   spinButton.setAttribute('data-tooltip', 'Spin in progress...');
              } else if (wheelEntries.length < 2 && users.length > 0) {
                  spinButton.setAttribute('data-tooltip', 'Select at least 2 participants (or increase weights)');
              } else if (users.length === 0) {
                   spinButton.setAttribute('data-tooltip', 'Add users first');
               } else {
                  spinButton.removeAttribute('data-tooltip'); // No tooltip needed when enabled
              }
          }

        // --- Export Functions ---
          function generateTimestamp() {
               return new Date().toISOString().replace(/[:.]/g, '-'); // Filesystem-safe timestamp
          }

          function downloadFile(filename, content, contentType) {
              const blob = new Blob([content], { type: contentType });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              // Cleanup
              setTimeout(() => {
                   document.body.removeChild(a);
                   URL.revokeObjectURL(url);
               }, 100);
          }

          exportHistoryBtn.addEventListener('click', () => {
              if (history.length === 0) { alert('No history to export.'); return; }
              let exportText = "Spin History Log\n====================\n\n";
              exportText += history.slice().reverse().join('\n'); // Reverse to show oldest first

               const filename = `wheel-history-${generateTimestamp()}.txt`;
              downloadFile(filename, exportText, 'text/plain;charset=utf-8');

               addToHistory('Exported spin history to text file');
               saveToLocalStorage(); // Save history including the export event
          });

          exportUsersBtn.addEventListener('click', () => {
               if (users.length === 0) { alert('No users to export.'); return; }
               let exportText = "User List (Name, Weight)\n=========================\n\n";
                exportText += "Name,Weight\n"; // CSV Header
                users.forEach(user => {
                     // Escape commas in names if any for proper CSV
                     const escapedName = `"${user.name.replace(/"/g, '""')}"`;
                     exportText += `${escapedName},${user.weight}\n`;
                });

                const filename = `wheel-users-${generateTimestamp()}.csv`;
               downloadFile(filename, exportText, 'text/csv;charset=utf-8');

                addToHistory('Exported user list to CSV file');
                saveToLocalStorage(); // Save potentially updated history
           });


        // --- Event Listeners ---
        userForm.addEventListener('submit', (e) => {
             e.preventDefault();
             addUser(usernameInput.value);
             usernameInput.value = ''; // Clear input after add
             usernameInput.focus(); // Keep focus for next entry
         });

        spinButton.addEventListener('click', spinWheel);

         selectAllBtn.addEventListener('click', () => {
             userCheckboxList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                 if (!cb.checked) cb.checked = true;
             });
             updateSelectedUsers(); // Update state
              saveToLocalStorage(); // Save changes
             addToHistory('Selected all users.');
         });

         deselectAllBtn.addEventListener('click', () => {
             userCheckboxList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                  if (cb.checked) cb.checked = false;
             });
              updateSelectedUsers(); // Update state
              saveToLocalStorage(); // Save changes
              addToHistory('Deselected all users.');
         });

         clearHistoryBtn.addEventListener('click', () => {
              if (history.length === 0) {
                  alert("History is already empty.");
                  return;
               }
             if (confirm('Are you sure you want to clear the entire spin history? This cannot be undone.')) {
                  history = [];
                  updateHistoryList();
                  const clearMsg = '🧹 Spin history cleared.';
                  addToHistory(clearMsg); // Add clearing itself to history temporarily (will be saved cleared)
                  notifyTelegram(clearMsg);
                  saveToLocalStorage(); // Save the cleared history
              }
         });

         // Add key listeners for convenience (e.g., Enter in modal)
         bulkImportText.addEventListener('keydown', (e) => {
             // Ctrl+Enter or Cmd+Enter to confirm import
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                   e.preventDefault(); // Prevent newline in textarea
                   confirmImportBtn.click(); // Trigger import
              }
          });
          document.addEventListener('keydown', (e) => {
              // Escape key to close modal
               if (e.key === 'Escape' && importModal.classList.contains('visible')) {
                   closeModal();
               }
           });


        // --- Initial Load & Setup ---
        console.log("Initializing Wheel of Names App...");
        // Load theme first to prevent flash of wrong theme
        applyTheme(localStorage.getItem('wheelTheme') || (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'));
        loadFromLocalStorage(); // Load data after DOM is ready

        // Initial Check for Telegram Config (after loading state, before first notify attempt)
         window.telegramWarningLogged = false; // Reset warning flag on each load
         const isUrlPlaceholder = !TELEGRAM_NOTIFY_URL || TELEGRAM_NOTIFY_URL.includes('localhost') || TELEGRAM_NOTIFY_URL.includes('YOUR_BACKEND');
         const isChatIdPlaceholder = !TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === '1732455712' || TELEGRAM_CHAT_ID.toLowerCase().includes('your');
         if (isUrlPlaceholder || isChatIdPlaceholder) {
              const initialWarning = "⚠️ Telegram notifications require configuration in index.html (TELEGRAM_NOTIFY_URL, TELEGRAM_CHAT_ID) and a running bot-server.js backend.";
              console.warn(initialWarning);
              // Add only if history doesn't already contain a similar message from load
               if (!history.some(h => h.includes("Telegram notification skipped"))) {
                  addToHistory(initialWarning);
                  saveToLocalStorage(); // Save this initial warning
               }
              window.telegramWarningLogged = true; // Prevent repeat warnings in session
          } else {
              console.log("Telegram notifications appear configured.");
              // Add only if no config warning present
               if (!history.some(h => h.includes("Telegram notification"))) {
                   addToHistory("✅ Telegram notifications configured.");
                   saveToLocalStorage();
               }
          }
           console.log("Initialization complete.");

    });
