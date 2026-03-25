document.addEventListener('DOMContentLoaded', () => {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

            if (href === '#auditoria') {
                e.preventDefault();
                if (window.openModal) window.openModal();
                return;
            }

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
    function setupModal(modalId, triggerElementId) {
        const modal = document.getElementById(modalId);
        if (!modal) return null;

        const closeBtn = modal.querySelector('.close-modal');
        const triggerElement = triggerElementId ? document.getElementById(triggerElementId) : null;

        function show() {
            modal.style.display = 'block';
            setTimeout(() => modal.classList.add('show'), 10);
        }

        function hide() {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }

        if (triggerElement) {
            triggerElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                show();
            });
            triggerElement.style.cursor = 'pointer';
        }

        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                hide();
            };
        }

        return { show, hide };
    }

    // Initialize Audit Modal (reusing same ID structure as main page)
    const auditModal = setupModal('contact-modal', null);
    window.openModal = function () {
        if (auditModal) auditModal.show();
    };

    // Global Close
    window.addEventListener('click', (event) => {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.classList.remove('show');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        });
    });

    // Test Modal Logic
    const testModalObj = setupModal('test-modal', null);
    window.openTestModal = function () {
        if (testModalObj) {
            resetTest();
            testModalObj.show();
        }
    };

    // Form Submission (Audit specific to clinics)
    const auditForm = document.getElementById('audit-form');
    if (auditForm) {
        auditForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            var btn = document.getElementById('submit-btn');
            var errorDiv = document.getElementById('form-error');
            var successDiv = document.getElementById('form-success');
            var form = document.getElementById('audit-form');
            btn.textContent = 'Enviando...';
            btn.disabled = true;
            errorDiv.style.display = 'none';
            var data = {
                Nombre: document.getElementById('name').value,
                Apellidos: document.getElementById('apellidos').value,
                Email: document.getElementById('email').value,
                Especialidad: document.getElementById('especialidad').value,
                Necesidad: document.getElementById('message').value,
                Presupuesto: document.getElementById('presupuesto').value
            };
            try {
                // Clinic-specific webhook
                await fetch('https://n8n.davidincertis.com/webhook/cbfabc35-27eb-4c76-8aa9-fef8963ac009', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                    mode: 'no-cors'
                });
                form.style.display = 'none';
                successDiv.style.display = 'block';
            } catch (err) {
                errorDiv.style.display = 'block';
                btn.textContent = 'Enviar Solicitud';
                btn.disabled = false;
            }
        });
    }

    // Health Test Form Logic
    window.calculateResults = function () {
        let checkedCount = 0;
        const checks = document.querySelectorAll('.test-check');

        checks.forEach(check => {
            if (check.checked) checkedCount++;
        });

        document.getElementById('test-intro').style.display = 'none';

        const resultsDiv = document.getElementById('test-results');
        resultsDiv.style.display = 'block';

        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultMsg = document.getElementById('result-message');
        const resultBtn = document.getElementById('result-action-btn');

        if (checkedCount <= 2) {
            resultIcon.textContent = '🟢';
            resultTitle.textContent = 'CLÍNICA DE ALTO RENDIMIENTO';
            resultTitle.style.color = '#10b981'; // Green
            resultMsg.innerHTML = '¡Enhorabuena! Tienes un sistema de gestión robusto. Tu personal dedica su tiempo a atender pacientes y a tareas de alto valor, no a pelearse con el papeleo. Eres un referente en tu sector.';
            resultBtn.textContent = 'Agendar reunión';
        } else if (checkedCount >= 3 && checkedCount <= 6) {
            resultIcon.textContent = '🟡';
            resultTitle.innerHTML = 'CLÍNICA CON FUGAS<br><span style="font-size: 0.7em; opacity: 0.85;">("LEAKY CLINIC")</span>';
            resultTitle.style.color = '#fbbf24'; // Yellow
            resultMsg.innerHTML = 'Estás perdiendo dinero todos los meses de forma invisible. Las horas que tu equipo dedica a tareas manuales (recordatorios, facturas, cuadrar agendas) frenan el crecimiento de la clínica. Tienes margen para aumentar tu facturación un 20% solo tapando estas fugas operativas.';
            resultBtn.textContent = 'Agendar Auditoría Clínica (15 min)';
        } else {
            resultIcon.textContent = '🔴';
            resultTitle.innerHTML = 'ALERTA ROJA<br><span style="font-size: 0.7em; opacity: 0.85;">(CUELLO DE BOTELLA CRÍTICO)</span>';
            resultTitle.style.color = '#ef4444'; // Red
            resultMsg.innerHTML = 'Tu clínica te controla a ti y no al revés. Estás asumiendo riesgos legales con los datos, perdiendo miles de euros al año en citas no presentadas y quemando a tu personal (o a ti mismo) con tareas que un software haría gratis y sin errores. Necesitas un "Cerebro Digital" urgente.';
            resultBtn.textContent = 'Reservar sesión prioritaria';
        }

        if (resultBtn) {
            resultBtn.onclick = () => {
                if (testModalObj) testModalObj.hide();
                setTimeout(() => {
                    window.location.href = '#auditoria';
                    if (window.openModal) window.openModal();
                }, 300);
            };
        }
    };

    window.resetTest = function () {
        document.querySelectorAll('.test-check').forEach(check => check.checked = false);
        document.getElementById('test-intro').style.display = 'block';
        document.getElementById('test-results').style.display = 'none';
    };

    // Escuchar cambios de hash para enlaces externos o del chat n8n
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#auditoria') {
            if (window.openModal) window.openModal();
            history.replaceState(null, null, window.location.pathname);
        }
    });

    // Interceptar clicks en enlaces del chat para que no abran pestaña nueva
    document.body.addEventListener('click', function(e) {
        const a = e.target.closest('a');
        if (a && a.href && a.href.includes('#auditoria')) {
            if (a.closest('.chat-message') || a.closest('.chat-message-markdown') || a.closest('.n8n-chat')) {
                e.preventDefault();
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
