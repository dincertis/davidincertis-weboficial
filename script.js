// Smooth scroll for anchor links
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');

    // Hero Text Parallax Effect
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        // Limit progress between 0 and 1 over 500px of scroll
        const progress = Math.min(scrollY / 500, 1);
        document.documentElement.style.setProperty('--hero-spread', progress);
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            console.log('Clicked link:', href);

            // Check if it's an anchor that should open the modal
            if (href === '#auditoria') {
                e.preventDefault();
                console.log('Opening contact modal via link');
                if (window.openModal) window.openModal();
                return;
            }

            // Standard smooth scroll for other links
            const targetId = this.getAttribute('href');
            if (targetId && targetId !== '#') {
                e.preventDefault();
                const target = document.querySelector(targetId);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Modal Logic System
    function setupModal(modalId, triggerElement) {
        console.log(`Setting up modal: ${modalId}`);
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal not found: ${modalId}`);
            return null;
        }

        // Use querySelector to find the close button within THIS specific modal
        const closeBtn = modal.querySelector('.close-modal');

        function show() {
            console.log(`Showing modal: ${modalId}`);
            modal.style.display = 'block';
            setTimeout(() => modal.classList.add('show'), 10);
        }

        function hide() {
            console.log(`Hiding modal: ${modalId}`);
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }

        if (triggerElement) {
            console.log(`Attaching click listener to trigger for ${modalId}`);
            // Remove old listeners if any by cloning (optional, but clean)
            // triggerElement.replaceWith(triggerElement.cloneNode(true)); 
            // Better not clone as it kills other listeners. Just add.

            triggerElement.addEventListener('click', (e) => {
                // Prevent bubbling if it's inside a link (though here it's a div)
                // But mostly to prevent defaults
                e.preventDefault();
                e.stopPropagation(); // Stop bubbling so window click doesn't hide it immediately
                show();
            });

            // Visual cue
            triggerElement.style.cursor = 'pointer';
        } else {
            console.warn(`No trigger element provided for ${modalId}`);
        }

        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                hide();
            };
        }

        return { show, hide };
    }

    // Initialize Modals
    // Contact Modal (Global access needed for direct calls)
    const contactModal = setupModal('contact-modal', null);

    // Expose for existing onclicks (like in the audit/brain modal buttons)
    window.openModal = function () {
        if (contactModal) contactModal.show();
    };

    // Audit Modal
    const auditCard = document.getElementById('audit-card');
    setupModal('audit-modal', auditCard);

    // Business OS Modal
    const brainCard = document.getElementById('brain-card');
    if (brainCard) {
        console.log('Brain card found');
        setupModal('brain-modal', brainCard);
    } else {
        console.error('Brain card NOT found');
    }

    // Consulting Modal
    const consultingCard = document.getElementById('consulting-card');
    if (consultingCard) {
        setupModal('consulting-modal', consultingCard);
    }

    // Client Modals
    const clientChou = document.getElementById('client-chou');
    if (clientChou) setupModal('modal-chou', clientChou);
    const clientChou2 = document.getElementById('client-chou-2');
    if (clientChou2) setupModal('modal-chou', clientChou2);

    const clientWorkshop = document.getElementById('client-workshop');
    if (clientWorkshop) setupModal('modal-workshop', clientWorkshop);
    const clientWorkshop2 = document.getElementById('client-workshop-2');
    if (clientWorkshop2) setupModal('modal-workshop', clientWorkshop2);

    const clientIsabel = document.getElementById('client-isabel');
    if (clientIsabel) setupModal('modal-isabel', clientIsabel);
    const clientIsabel2 = document.getElementById('client-isabel-2');
    if (clientIsabel2) setupModal('modal-isabel', clientIsabel2);

    const clientDoctor = document.getElementById('client-doctor');
    if (clientDoctor) setupModal('modal-doctor', clientDoctor);
    const clientDoctor2 = document.getElementById('client-doctor-2');
    if (clientDoctor2) setupModal('modal-doctor', clientDoctor2);

    const clientAgua = document.getElementById('client-agua');
    if (clientAgua) setupModal('modal-agua', clientAgua);
    const clientAgua2 = document.getElementById('client-agua-2');
    if (clientAgua2) setupModal('modal-agua', clientAgua2);

    const clientPoeme = document.getElementById('client-poeme');
    if (clientPoeme) setupModal('modal-poeme', clientPoeme);
    const clientPoeme2 = document.getElementById('client-poeme-2');
    if (clientPoeme2) setupModal('modal-poeme', clientPoeme2);

    // Global Close on outside click
    // We attach ONE listener to window to handle ALL open modals
    window.addEventListener('click', (event) => {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                console.log('Clicked outside modal, closing');
                modal.classList.remove('show');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        });
    });

    // Test Modal Logic
    const testModal = setupModal('test-modal', null);
    window.openTestModal = function () {
        if (testModal) {
            resetTest(); // Assure it starts from beginning
            testModal.show();
        }
    };

    // Make global functions for template switching
    window.showPymeTest = function () {
        document.getElementById('test-selection').style.display = 'none';
        document.getElementById('test-pyme').style.display = 'block';
    };

    window.showFreelanceTest = function () {
        document.getElementById('test-selection').style.display = 'none';
        document.getElementById('test-freelance').style.display = 'block';
    };

    window.calculateResults = function (type) {
        let checkedCount = 0;
        let checks;

        if (type === 'pyme') {
            checks = document.querySelectorAll('.test-check-pyme');
            document.getElementById('test-pyme').style.display = 'none';
        } else if (type === 'freelance') {
            checks = document.querySelectorAll('.test-check-freelance');
            document.getElementById('test-freelance').style.display = 'none';
        }

        checks.forEach(check => {
            if (check.checked) checkedCount++;
        });

        const resultsDiv = document.getElementById('test-results');
        resultsDiv.style.display = 'block';

        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultMsg = document.getElementById('result-message');
        const resultBtn = document.getElementById('result-action-btn');

        if (type === 'pyme') {
            if (checkedCount <= 2) {
                resultIcon.textContent = '✅';
                resultTitle.textContent = '¡ENHORABUENA!';
                resultTitle.style.color = 'var(--color-accent-primary)';
                resultMsg.innerHTML = 'TU NEGOCIO GOZA DE BUENA SALUD.<br><br>Si aun así crees que puedes mejorar algún proceso o quieres explorar una nueva implementación, contáctame.';
                resultBtn.textContent = 'Agendar reunión';
            } else if (checkedCount >= 3 && checkedCount <= 6) {
                resultIcon.textContent = '⚠️';
                resultTitle.textContent = 'ZONA DE PELIGRO';
                resultTitle.style.color = '#fbbf24'; // Orange/Yellow
                resultMsg.innerHTML = 'Estás perdiendo tiempo y dinero en tareas invisibles.<br><br>Agenda una reunión conmigo ahora mismo y te ayudaré a optimizar tus procesos.';
                resultBtn.textContent = 'Agendar reunión gratuita';
            } else {
                resultIcon.textContent = '🚨';
                resultTitle.textContent = 'ALERTA ROJA';
                resultTitle.style.color = '#ff4c38'; // Red
                resultMsg.innerHTML = 'Tu operativa es una bomba de relojería. Necesitas automatizar urgentemente.<br><br>Agenda ahora mismo una reunión conmigo y nos ponemos manos a la obra.';
                resultBtn.textContent = 'Agendar reunión'; // Replaced sálvame la vida with agendar reunión
            }
        } else if (type === 'freelance') {
            if (checkedCount <= 2) {
                resultIcon.textContent = '✅';
                resultTitle.textContent = '¡AUTÓNOMO NINJA!';
                resultTitle.style.color = 'var(--color-accent-primary)';
                resultMsg.innerHTML = 'Tienes tu negocio bajo control. Tus sistemas te permiten centrarte en lo que realmente aporta valor (tu trabajo y conseguir clientes).';
                resultBtn.textContent = 'Agendar reunión';
            } else if (checkedCount >= 3 && checkedCount <= 6) {
                resultIcon.textContent = '⚠️';
                resultTitle.textContent = 'ZONA DE FRICCIÓN';
                resultTitle.style.color = '#fbbf24'; // Orange/Yellow
                resultMsg.innerHTML = 'Estás haciendo de secretario/a de ti mismo/a. Estás perdiendo al menos de 5 a 10 horas semanales en tareas que un sistema No-Code podría hacer gratis por ti. Esas horas podrías usarlas para facturar más o para descansar.';
                resultBtn.textContent = 'Agendar reunión gratuita';
            } else {
                resultIcon.textContent = '🚨';
                resultTitle.textContent = 'ALERTA DE BURNOUT';
                resultTitle.style.color = '#ff4c38'; // Red
                resultMsg.innerHTML = 'Tu negocio te controla a ti. El trabajo administrativo te está ahogando, estás perdiendo dinero por fallos de seguimiento y no puedes escalar. Necesitas automatizar tus procesos urgentemente.';
                resultBtn.textContent = 'Agendar reunión';
            }
        }

        if (resultBtn) {
            resultBtn.onclick = () => {
                if (testModal) testModal.hide();
                setTimeout(() => {
                    window.location.href = '#auditoria';
                    if (window.openModal) window.openModal();
                }, 300);
            };
        }
    };

    window.resetTest = function () {
        document.querySelectorAll('.test-check-pyme, .test-check-freelance').forEach(check => check.checked = false);
        document.getElementById('test-selection').style.display = 'block';
        document.getElementById('test-pyme').style.display = 'none';
        document.getElementById('test-freelance').style.display = 'none';
        document.getElementById('test-results').style.display = 'none';
    };

    // Escuchar cambios de hash para enlaces externos o del chat n8n
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#auditoria') {
            if (window.openModal) window.openModal();
            // Limpiar hash para permitir clics repetidos
            history.replaceState(null, null, window.location.pathname);
        }
    });

    // Interceptar clicks en enlaces del chat para que no abran pestaña nueva
    document.body.addEventListener('click', function(e) {
        const a = e.target.closest('a');
        if (a && a.href && a.href.includes('#auditoria')) {
            // Si el enlace está dentro de los mensajes del chat
            if (a.closest('.chat-message') || a.closest('.chat-message-markdown') || a.closest('.n8n-chat')) {
                e.preventDefault(); // Evita que se abra en target="_blank"
                if (window.openModal) window.openModal();
                history.replaceState(null, null, window.location.pathname);
            }
        }
    });

    // Comprobar hash al cargar la página
    if (window.location.hash === '#auditoria') {
        setTimeout(() => {
            if (window.openModal) window.openModal();
            history.replaceState(null, null, window.location.pathname);
        }, 500);
    }
});
