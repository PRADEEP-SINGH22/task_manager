const API_BASE = '/api';

let currentFolderId = null;
let allFolders = [];
let isCompletedView = false;
let sortable = null;
let searchQuery = '';
let currentSort = 'custom';

// Custom Modal Logic
function showModal(title, bodyText, confirmText, danger, onConfirm) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerText = bodyText;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    confirmBtn.innerText = confirmText;
    
    if (danger) {
        confirmBtn.className = 'modal-btn danger';
    } else {
        confirmBtn.className = 'modal-btn primary';
    }

    const close = () => {
        modal.style.display = 'none';
        confirmBtn.onclick = null;
        document.getElementById('modal-cancel-btn').onclick = null;
    };

    document.getElementById('modal-cancel-btn').onclick = close;
    confirmBtn.onclick = () => {
        onConfirm();
        close();
    };

    modal.style.display = 'flex';
}

// DOM Elements
const folderList = document.getElementById('folder-list');
const taskList = document.getElementById('task-list');
const deadlineTaskList = document.getElementById('deadline-task-list');
const deadlineSection = document.getElementById('deadline-section');
const nodelineSection = document.getElementById('nodeline-section');
const currentFolderTitle = document.getElementById('current-folder-title');
const taskCreator = document.getElementById('task-creator');
const newTaskTitle = document.getElementById('new-task-title');
const newTaskDesc = document.getElementById('new-task-desc');
const newTaskDeadline = document.getElementById('new-task-deadline');
const addTaskBtn = document.getElementById('add-task-btn');
const addFolderBtn = document.getElementById('add-folder-btn');
const completedFolderBtn = document.querySelector('.completed-folder');

// Init Icons
lucide.createIcons();

// Initialize SortableJS

async function init() {
    // Prevent back-dating tasks
    const todayDateStr = new Date().toISOString().split('T')[0];
    newTaskDeadline.setAttribute('min', todayDateStr);

    await fetchFolders();
    if (allFolders.length > 0) {
        selectFolder(allFolders[0].id);
    } else {
        selectFolder('inbox');
    }
    
    // Event Listeners
    document.getElementById('inbox-folder').addEventListener('click', () => selectFolder('inbox'));
    addTaskBtn.addEventListener('click', addTask);
    addFolderBtn.addEventListener('click', handleAddFolder);
    completedFolderBtn.addEventListener('click', () => selectCompletedView());
    
    // Mobile menu toggles
    document.getElementById('mobile-menu-open').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
    });
    document.getElementById('mobile-menu-close').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
    });

    // Desktop sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('collapsed');
        document.getElementById('desktop-menu-open').style.display = 'block';
    });
    document.getElementById('desktop-menu-open').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('collapsed');
        document.getElementById('desktop-menu-open').style.display = 'none';
    });

    // Search logic
    const searchInput = document.getElementById('task-search-input');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        if (currentFolderId) fetchTasks(currentFolderId);
        else if (isCompletedView) selectCompletedView();
    });

    // Sort logic
    document.getElementById('task-sort-select').addEventListener('change', (e) => {
        currentSort = e.target.value;
        if (currentFolderId) fetchTasks(currentFolderId);
        else if (isCompletedView) selectCompletedView();
        
        if (sortable) {
            sortable.option("disabled", currentSort !== 'custom');
        }
    });

    // Enter to add task
    const enterHandler = (e) => {
        if (e.key === 'Enter') addTask();
    };
    document.getElementById('new-task-title').addEventListener('keydown', enterHandler);
    document.getElementById('new-task-desc').addEventListener('keydown', enterHandler);

    // Header Rename Logic
    document.getElementById('header-rename-btn').addEventListener('click', async () => {
        if (!currentFolderId) return;
        const folder = allFolders.find(f => f.id === currentFolderId);
        let newName = prompt("Rename folder (max 50 characters):", folder.name);
        if (newName && newName.trim() && newName.trim() !== folder.name) {
            newName = newName.trim();
            if (newName.length > 50) {
                alert("Folder name cannot exceed 50 characters.");
                return;
            }
            const res = await fetch(`${API_BASE}/folders/${folder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() })
            });
            if (res.ok) {
                await fetchFolders();
                currentFolderTitle.innerText = newName.trim();
            } else {
                alert("Failed to rename folder. Name might already exist.");
            }
        }
    });
}

async function fetchFolders() {
    const res = await fetch(`${API_BASE}/folders/?_=${Date.now()}`);
    allFolders = await res.json();
    allFolders.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    renderFolders();
}

function renderFolders() {
    folderList.innerHTML = '';
    
    document.getElementById('inbox-folder').classList.toggle('active', currentFolderId === 'inbox' && !isCompletedView);
    completedFolderBtn.classList.toggle('active', isCompletedView);
    
    allFolders.forEach(folder => {
        const li = document.createElement('li');
        li.className = `folder-item ${currentFolderId === folder.id && !isCompletedView ? 'active' : ''}`;
        
        // Task Count & Badges
        const totalTasks = folder.tasks ? folder.tasks.length : 0;
        const activeTasks = folder.tasks ? folder.tasks.filter(t => !t.is_completed).length : 0;
        
        let badgeHtml = '';
        if (totalTasks === 0) {
            badgeHtml = `<span class="folder-badge empty-badge">Empty</span>`;
        } else if (activeTasks === 0) {
            badgeHtml = `<span class="folder-badge done-badge">All done</span>`;
        } else {
            badgeHtml = `<span class="folder-badge count-badge">${activeTasks}</span>`;
        }

        // Deterministic color based on ID
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
        const color = colors[folder.id % colors.length];

        li.setAttribute('aria-label', `Folder: ${folder.name}, ${activeTasks} active tasks`);
        li.title = folder.name; // Tooltip for truncation
        
        li.innerHTML = `
            <div class="folder-info">
                <div style="display:flex; align-items:center; gap: 8px;">
                    <i data-lucide="folder" style="flex-shrink:0; color:${color};"></i> 
                    <span class="folder-name-text" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${folder.name}</span>
                </div>
                <div class="folder-meta" style="margin-top:4px;">${badgeHtml}</div>
                <input type="text" class="folder-rename-input folder-edit-input" style="display:none; margin-top:4px;" value="${folder.name.replace(/"/g, '&quot;')}" maxlength="50">
            </div>
            <div class="folder-actions-container">
                <button class="rename-btn" title="Rename Folder" type="button">
                    <i data-lucide="pencil" style="width:14px; height:14px;"></i>
                </button>
                <button class="delete-folder-btn" title="Delete Folder" type="button">
                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                </button>
            </div>
        `;
        li.onclick = () => selectFolder(folder.id);
        
        const textSpan = li.querySelector('.folder-name-text');
        const metaSpan = li.querySelector('.folder-meta');
        const inputEl = li.querySelector('.folder-rename-input');
        
        const renameBtn = li.querySelector('.rename-btn');
        renameBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            textSpan.style.display = 'none';
            metaSpan.style.display = 'none';
            inputEl.style.display = 'block';
            inputEl.focus();
            inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
            
            const finishRename = async () => {
                const newName = inputEl.value.trim();
                if (newName && newName !== folder.name) {
                    const res = await fetch(`${API_BASE}/folders/${folder.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newName })
                    });
                    if (res.ok) {
                        await fetchFolders();
                        if (currentFolderId === folder.id) currentFolderTitle.innerText = newName;
                    } else {
                        alert("Failed to rename folder. Name might already exist.");
                        fetchFolders(); // revert UI
                    }
                } else {
                    textSpan.style.display = 'block';
                    metaSpan.style.display = 'block';
                    inputEl.style.display = 'none';
                    inputEl.value = folder.name;
                }
            };
            
            inputEl.onblur = finishRename;
            inputEl.onkeydown = (ev) => {
                if (ev.key === 'Enter') inputEl.blur();
                if (ev.key === 'Escape') { inputEl.value = folder.name; inputEl.blur(); }
            };
        };
        
        const deleteFolderBtn = li.querySelector('.delete-folder-btn');
        deleteFolderBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            showModal(
                "Delete Folder",
                `Are you sure you want to completely delete "${folder.name}" and all its tasks?`,
                "Delete",
                true,
                async () => {
                    await fetch(`${API_BASE}/folders/${folder.id}`, { method: 'DELETE' });
                    if (currentFolderId === folder.id) currentFolderId = null;
                    await fetchFolders();
                    if (allFolders.length > 0) selectFolder(allFolders[0].id);
                    else selectCompletedView();
                }
            );
        };
        
        folderList.appendChild(li);
    });
    lucide.createIcons();
}

async function selectFolder(id) {
    isCompletedView = false;
    currentFolderId = id;
    
    let folderName = "Inbox";
    if (id !== 'inbox') {
        const folder = allFolders.find(f => f.id === id);
        if (folder) folderName = folder.name;
    }
    currentFolderTitle.innerText = folderName;
    
    document.getElementById('header-rename-btn').style.display = id === 'inbox' ? 'none' : 'block';
    taskCreator.style.display = 'block';
    
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
    renderFolders(); // Re-render to update active state
    
    await fetchTasks(id);
    
    // Setup drag and drop for non-deadline tasks
    if (sortable) sortable.destroy();
    sortable = new Sortable(taskList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: async function (evt) {
            const taskItems = Array.from(taskList.children);
            const reorders = taskItems.map((item, index) => ({
                task_id: parseInt(item.dataset.id),
                new_sort_order: index
            }));
            
            await fetch(`${API_BASE}/tasks/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reorders)
            });
        },
    });
}

async function selectCompletedView() {
    isCompletedView = true;
    currentFolderId = null;
    currentFolderTitle.innerText = "Completed Tasks";
    document.getElementById('header-rename-btn').style.display = 'none';
    taskCreator.style.display = 'none';
    deadlineSection.style.display = 'none';
    
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
    completedFolderBtn.classList.add('active');
    
    // Fetch all tasks and filter completed
    const res = await fetch(`${API_BASE}/tasks/?_=${Date.now()}`);
    const allTasks = await res.json();
    const completedTasks = allTasks.filter(t => t.is_completed);
    document.getElementById('current-folder-stats').innerText = `${completedTasks.length} completed tasks`;
    
    if (sortable) { sortable.destroy(); sortable = null; } // No manual sorting in completed
    
    let sortedTasks = [...completedTasks];
    if (currentSort === 'due_date') {
        sortedTasks.sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        });
    } else if (currentSort === 'priority') {
        sortedTasks.sort((a, b) => b.priority - a.priority);
    } else if (currentSort === 'alphabetical') {
        sortedTasks.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    renderTasksList(sortedTasks, taskList, true);
}

async function fetchTasks(folderId) {
    let res;
    if (folderId === 'inbox') {
        res = await fetch(`${API_BASE}/tasks/inbox?_=${Date.now()}`);
    } else {
        res = await fetch(`${API_BASE}/tasks/folder/${folderId}?_=${Date.now()}`);
    }
    let tasks = await res.json();
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.is_completed).length;
    document.getElementById('current-folder-stats').innerText = `${totalTasks} total tasks • ${completedTasks} completed`;
    
    // Filter out completed tasks from regular view
    tasks = tasks.filter(t => !t.is_completed);
    
    if (currentSort !== 'custom') {
        let sortedTasks = [...tasks];
        if (currentSort === 'due_date') {
            sortedTasks.sort((a, b) => {
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline) - new Date(b.deadline);
            });
        } else if (currentSort === 'priority') {
            sortedTasks.sort((a, b) => b.priority - a.priority);
        } else if (currentSort === 'alphabetical') {
            sortedTasks.sort((a, b) => a.title.localeCompare(b.title));
        }
        deadlineSection.style.display = 'none';
        renderTasksList(sortedTasks, taskList);
    } else {
        const withDeadline = tasks.filter(t => t.deadline).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        const withoutDeadline = tasks.filter(t => !t.deadline).sort((a, b) => a.sort_order - b.sort_order);
        
        if (withDeadline.length > 0) {
            deadlineSection.style.display = 'block';
            renderTasksList(withDeadline, deadlineTaskList);
        } else {
            deadlineSection.style.display = 'none';
        }
        
        renderTasksList(withoutDeadline, taskList);
    }
}

function renderTasksList(tasks, container, showFolderTag = false) {
    container.innerHTML = '';
    // Filter by search query
    if (searchQuery) {
        tasks = tasks.filter(t => t.title.toLowerCase().includes(searchQuery) || (t.description && t.description.toLowerCase().includes(searchQuery)));
    }

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 60px 20px;">
                <i data-lucide="inbox" style="width:48px; height:48px; margin-bottom:16px; opacity:0.3;"></i>
                <div style="font-size:1.1rem; font-weight:600; color:var(--text-primary); margin-bottom:4px;">It's quiet here...</div>
                <div style="font-size:0.85rem;">Add a task above to get started!</div>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.is_completed ? 'completed' : ''}`;
        item.dataset.id = task.id;
        
        let deadlineBadgeHtml = '';
        if (task.deadline) {
            const d = new Date(task.deadline);
            const today = new Date();
            today.setHours(0,0,0,0);
            const deadlineDate = new Date(d);
            deadlineDate.setHours(0,0,0,0);
            const diffTime = deadlineDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let daysLeftText = '';
            let badgeClass = '';
            if (diffDays === 0) { daysLeftText = 'Today'; badgeClass = 'today'; }
            else if (diffDays === 1) daysLeftText = 'Tomorrow';
            else if (diffDays > 1) daysLeftText = `${diffDays} Days Left`;
            else if (diffDays < 0) { daysLeftText = `${Math.abs(diffDays)} Days Overdue`; badgeClass = 'overdue'; }

            deadlineBadgeHtml = `
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap: 4px; margin-right: 12px; margin-left: auto;">
                    <span class="days-left-badge ${badgeClass}">${daysLeftText}</span>
                    <span style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
                        <i data-lucide="calendar" style="width:10px; height:10px;"></i> ${d.toLocaleDateString()}
                    </span>
                </div>
            `;
        }
        
        let folderTagHtml = '';
        if (showFolderTag) {
            const folderObj = allFolders.find(f => f.id === task.folder_id);
            const folderName = folderObj ? folderObj.name : 'Unknown Folder';
            folderTagHtml = `<div class="task-meta"><span class="folder-tag">${folderName}</span></div>`;
        }

        let priorityHtml = '';
        if (task.priority === 2) priorityHtml = `<span class="priority-tag priority-2">Med</span>`;
        else if (task.priority === 3) priorityHtml = `<span class="priority-tag priority-3">High</span>`;
        else priorityHtml = `<span class="priority-tag priority-1">Low</span>`;

        item.innerHTML = `
            <div class="checkbox ${task.is_completed ? 'checked' : ''}"></div>
            <div class="task-content" style="flex:1; overflow:hidden;">
                <div class="task-display">
                    <div class="task-title" style="display:flex; align-items:center; gap:8px;">
                        ${task.title}
                        ${priorityHtml}
                    </div>
                    ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                    ${folderTagHtml}
                </div>
                <div class="task-edit" style="display:none; width: 100%;">
                    <input type="text" class="edit-task-title edit-task-input" value="${task.title.replace(/"/g, '&quot;')}">
                    <input type="text" class="edit-task-desc edit-task-input" value="${task.description ? task.description.replace(/"/g, '&quot;') : ''}" placeholder="Description">
                    <div style="display:flex; gap:8px; margin-top:4px;">
                        <select class="edit-task-priority edit-task-input" style="flex:1;">
                            <option value="1" ${task.priority === 1 ? 'selected' : ''}>Low Priority</option>
                            <option value="2" ${task.priority === 2 ? 'selected' : ''}>Med Priority</option>
                            <option value="3" ${task.priority === 3 ? 'selected' : ''}>High Priority</option>
                        </select>
                        <select class="edit-task-folder edit-task-input" style="flex:1;">
                            <option value="inbox" ${task.folder_id === null ? 'selected' : ''}>Inbox</option>
                            ${allFolders.map(f => `<option value="${f.id}" ${task.folder_id === f.id ? 'selected' : ''}>${f.name.replace(/"/g, '&quot;')}</option>`).join('')}
                        </select>
                        <input type="date" class="edit-task-deadline edit-task-input" value="${task.deadline ? task.deadline.split('T')[0] : ''}" style="flex:1;">
                    </div>
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <button class="modal-btn secondary cancel-edit-btn" style="padding:2px 8px; font-size:0.7rem;" type="button">Cancel</button>
                        <button class="modal-btn primary save-edit-btn" style="padding:2px 8px; font-size:0.7rem; background:var(--accent-color); color:white; border:none;" type="button">Save</button>
                    </div>
                </div>
            </div>
            <div class="task-actions" style="display:flex; align-items:center; gap:8px;">
                ${deadlineBadgeHtml}
                <div class="task-actions-container" style="display:flex; align-items:center; gap:8px; margin-left:8px;">
                    <button class="edit-task-btn" title="Edit Task" type="button" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer;"><i data-lucide="pencil" style="width:14px; height:14px;"></i></button>
                    <button class="delete-btn" title="Permanently Delete" type="button" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer;"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
                </div>
            </div>
        `;
        
        const checkbox = item.querySelector('.checkbox');
        checkbox.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTask(task.id, task.is_completed);
        };
        
        const deleteBtn = item.querySelector('.delete-btn');
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showModal(
                "Delete Task",
                "Are you sure you want to permanently delete this task?",
                "Delete",
                true,
                () => deleteTask(task.id)
            );
        };
        
        const editBtn = item.querySelector('.edit-task-btn');
        const taskDisplay = item.querySelector('.task-display');
        const taskEdit = item.querySelector('.task-edit');
        
        editBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            taskDisplay.style.display = 'none';
            taskEdit.style.display = 'block';
        };
        
        item.querySelector('.cancel-edit-btn').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            taskDisplay.style.display = 'block';
            taskEdit.style.display = 'none';
        };
        
        item.querySelector('.save-edit-btn').onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newTitle = item.querySelector('.edit-task-title').value.trim();
            const newDesc = item.querySelector('.edit-task-desc').value.trim();
            const newPriority = parseInt(item.querySelector('.edit-task-priority').value);
            const newFolder = item.querySelector('.edit-task-folder').value;
            const newDeadline = item.querySelector('.edit-task-deadline').value;
            
            if (newTitle) {
                const updateData = {
                    title: newTitle,
                    description: newDesc || null,
                    priority: newPriority,
                    folder_id: newFolder === 'inbox' ? null : parseInt(newFolder)
                };
                if (newDeadline) {
                    updateData.deadline = new Date(newDeadline).toISOString();
                } else {
                    updateData.deadline = null;
                }
                
                await fetch(`${API_BASE}/tasks/${task.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                if (isCompletedView) selectCompletedView();
                else fetchTasks(currentFolderId);
            }
        };

        container.appendChild(item);
    });
    lucide.createIcons();
}

async function addTask() {
    if (!currentFolderId && !isCompletedView) return;

    const newTaskTitle = document.getElementById('new-task-title');
    const newTaskDesc = document.getElementById('new-task-desc');
    const newTaskDeadline = document.getElementById('new-task-deadline');
    const newTaskPriority = document.getElementById('new-task-priority');
    
    const titleVal = newTaskTitle.value.trim();
    if (!titleVal) {
        alert("Task title cannot be empty!");
        newTaskTitle.focus();
        return;
    }

    let deadlineIso = null;
    if (newTaskDeadline.value) {
        deadlineIso = new Date(newTaskDeadline.value).toISOString();
    }

    const taskData = {
        title: titleVal,
        description: newTaskDesc.value.trim() || null,
        deadline: deadlineIso,
        folder_id: currentFolderId === 'inbox' ? null : currentFolderId,
        priority: parseInt(newTaskPriority.value) || 1
    };
    
    await fetch(`${API_BASE}/tasks/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
    });
    
    newTaskTitle.value = '';
    newTaskDesc.value = '';
    newTaskDeadline.value = '';
    
    fetchTasks(currentFolderId);
}

async function toggleTask(id, currentStatus) {
    await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus })
    });
    
    if (isCompletedView) {
        selectCompletedView();
    } else {
        fetchTasks(currentFolderId);
    }
}

async function deleteTask(id) {
    await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE'
    });
    
    if (isCompletedView) {
        selectCompletedView();
    } else {
        fetchTasks(currentFolderId);
    }
}

async function handleAddFolder() {
    const li = document.createElement('li');
    li.className = 'folder-item';
    li.innerHTML = `
        <div style="display:flex; align-items:center; flex:1; overflow:hidden; gap: 8px;">
            <i data-lucide="folder"></i> 
            <input type="text" id="new-folder-input" class="folder-edit-input" placeholder="Folder Name" maxlength="50">
        </div>
    `;
    folderList.appendChild(li);
    lucide.createIcons();
    
    const inputEl = document.getElementById('new-folder-input');
    inputEl.focus();
    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    
    let isCreating = false;
    const finishCreate = async () => {
        if (isCreating) return;
        isCreating = true;
        const name = inputEl.value.trim();
        if (name) {
            const res = await fetch(`${API_BASE}/folders/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });
            if (res.ok) {
                const newFolder = await res.json();
                await fetchFolders();
                selectFolder(newFolder.id); 
            } else {
                alert("Failed to create folder. The folder name might already exist.");
                li.remove();
            }
        } else {
            li.remove();
        }
    };
    
    inputEl.onblur = finishCreate;
    inputEl.onkeydown = (ev) => {
        if (ev.key === 'Enter') inputEl.blur();
        if (ev.key === 'Escape') { inputEl.value = ''; inputEl.blur(); }
    };
}

// Start
init();
