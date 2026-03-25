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

    // Initialize Audit Modal
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

    // Form Submission (Audit specific to Inmobiliarias)
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
                // Inmobiliarias Webhook URL
                await fetch('https://n8n.davidincertis.com/webhook/7f0fbe16-5c11-4161-be07-d699b55c7198', {
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

    // Health Test Forms Routing
    window.showAgencyTest = function () {
        document.getElementById('test-selection').style.display = 'none';
        document.getElementById('test-agency').style.display = 'block';
        document.getElementById('test-freelance').style.display = 'none';
        document.getElementById('test-results').style.display = 'none';
    };

    window.showFreelanceTest = function () {
        document.getElementById('test-selection').style.display = 'none';
        document.getElementById('test-agency').style.display = 'none';
        document.getElementById('test-freelance').style.display = 'block';
        document.getElementById('test-results').style.display = 'none';
    };

    window.calculateAgencyResults = function () {
        let checkedCount = 0;
        const checks = document.querySelectorAll('.test-check-agency');

        checks.forEach(check => {
            if (check.checked) checkedCount++;
        });

        document.getElementById('test-agency').style.display = 'none';

        const resultsDiv = document.getElementById('test-results');
        resultsDiv.style.display = 'block';

        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultMsg = document.getElementById('result-message');
        const resultBtn = document.getElementById('result-action-btn');

        if (checkedCount <= 2) {
            resultIcon.textContent = '🟢';
            resultTitle.textContent = 'AGENCIA TOP PERFORMER';
            resultTitle.style.color = '#10b981'; // Green
            resultMsg.innerHTML = 'Tenéis una maquinaria de ventas engrasada. Vuestros agentes dedican el 90% de su tiempo a visitar y cerrar tratos.';
            resultBtn.textContent = 'Agendar reunión';
        } else if (checkedCount >= 3 && checkedCount <= 6) {
            resultIcon.textContent = '🟡';
            resultTitle.innerHTML = 'AGENCIA ATASCADA';
            resultTitle.style.color = '#fbbf24'; // Yellow
            resultMsg.innerHTML = 'Vuestro crecimiento ha tocado techo. Los agentes están haciendo labores administrativas que no aportan valor. Estáis perdiendo comisiones simplemente por no llegar a tiempo o no hacer un seguimiento adecuado.';
            resultBtn.textContent = 'Agendar Auditoría (15 min)';
        } else {
            resultIcon.textContent = '🔴';
            resultTitle.innerHTML = 'ALERTA ROJA (CAOS OPERATIVO)';
            resultTitle.style.color = '#ef4444'; // Red
            resultMsg.innerHTML = 'Vuestra agencia es una bomba de relojería. La fuga de clientes hacia la competencia es constante y el riesgo de cometer un error legal grave en los contratos o documentos es altísimo. Necesitáis automatizar los procesos urgentemente.';
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

    window.calculateFreelanceResults = function () {
        let checkedCount = 0;
        const checks = document.querySelectorAll('.test-check-freelance');

        checks.forEach(check => {
            if (check.checked) checkedCount++;
        });

        document.getElementById('test-freelance').style.display = 'none';

        const resultsDiv = document.getElementById('test-results');
        resultsDiv.style.display = 'block';

        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultMsg = document.getElementById('result-message');
        const resultBtn = document.getElementById('result-action-btn');

        if (checkedCount <= 2) {
            resultIcon.textContent = '🟢';
            resultTitle.textContent = 'Agente 3.0';
            resultTitle.style.color = '#10b981'; // Green
            resultMsg.innerHTML = 'Tienes un negocio optimizado. Eres un profesional que utiliza la tecnología para escalar su tiempo.';
            resultBtn.textContent = 'Agendar reunión';
        } else if (checkedCount >= 3 && checkedCount <= 6) {
            resultIcon.textContent = '🟡';
            resultTitle.innerHTML = 'Freelance "Auto-empleado"';
            resultTitle.style.color = '#fbbf24'; // Yellow
            resultMsg.innerHTML = 'No tienes un negocio, tienes un trabajo que te absorbe. Estás perdiendo al menos el 30% de tu tiempo en tareas administrativas que podrías delegar en un "cerebro digital".';
            resultBtn.textContent = 'Agendar Auditoría (15 min)';
        } else {
            resultIcon.textContent = '🔴';
            resultTitle.innerHTML = 'Riesgo de Colapso';
            resultTitle.style.color = '#ef4444'; // Red
            resultMsg.innerHTML = 'Estás a un paso del burnout. El desorden operativo te está haciendo perder comisiones reales y está dañando tu imagen profesional frente a los clientes.';
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
        document.querySelectorAll('.test-check-agency').forEach(check => check.checked = false);
        document.querySelectorAll('.test-check-freelance').forEach(check => check.checked = false);

        document.getElementById('test-selection').style.display = 'block';
        document.getElementById('test-agency').style.display = 'none';
        document.getElementById('test-freelance').style.display = 'none';
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
