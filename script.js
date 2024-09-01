document.addEventListener('DOMContentLoaded', function() {
    // Work item toggle functionality
    const workItems = document.querySelectorAll('.work-list .work-item');
    workItems.forEach(item => {
        const header = item.querySelector('.work-item-header');
        header.addEventListener('click', () => {
            item.classList.toggle('active');
        });
    });

    // Command menu functionality
    const commandMenu = document.getElementById('command-menu');
    const searchInput = commandMenu.querySelector('input');

    // Toggle command menu on Cmd+J or Ctrl+J
    document.addEventListener('keydown', function(event) {
        if (event.key === 'j' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            commandMenu.classList.toggle('hidden');
            if (!commandMenu.classList.contains('hidden')) {
                searchInput.focus();
            }
        }
    });

    // Close menu when clicking the close button
    const closeButton = commandMenu.querySelector('.close-button');
    closeButton.addEventListener('click', function() {
        commandMenu.classList.add('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        if (!commandMenu.contains(event.target) && !commandMenu.classList.contains('hidden')) {
            commandMenu.classList.add('hidden');
        }
    });

    // Handle menu item clicks
    const menuItems = commandMenu.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.dataset.action === 'print') {
                e.preventDefault();
                window.print();
            }
            commandMenu.classList.add('hidden');
        });
    });

    // Search functionality
    searchInput.addEventListener('input', function() {
        const filter = this.value.toLowerCase();
        menuItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            const section = item.closest('.section');
            if (text.includes(filter)) {
                item.style.display = '';
                section.style.display = '';
            } else {
                item.style.display = 'none';
                if ([...section.querySelectorAll('.menu-item')].every(i => i.style.display === 'none')) {
                    section.style.display = 'none';
                }
            }
        });
    });

    // Email functionality
    const emailLink = document.querySelector('a[aria-label="Email"]');
    if (emailLink) {
        emailLink.addEventListener('click', function(e) {
            e.preventDefault();
            const email = 'your.email' + '@' + 'example.com'; // Replace with your actual email
            window.location.href = 'mailto:' + email;
        });
    }
});