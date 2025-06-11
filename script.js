// Importa as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variáveis globais do Firebase (fornecidas pelo ambiente Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null; // ID do usuário logado
let isAuthReady = false; // Flag para indicar que a autenticação está pronta

// Coleções do Firestore
const getProductsCollectionRef = (uid) => collection(db, `artifacts/${appId}/users/${uid}/products`);
const getEmployeesCollectionRef = (uid) => collection(db, `artifacts/${appId}/users/${uid}/employees`);
const getSalesCollectionRef = (uid) => collection(db, `artifacts/${appId}/users/${uid}/sales`);

// Coleções do Firestore para ERP
const getCustomersCollectionRef = (uid) => collection(db, `artifacts/${appId}/users/${uid}/customers`);
const getSuppliersCollectionRef = (uid) => collection(db, `artifacts/${appId}/users/${uid}/suppliers`);
const getFinanceCollectionRef = (uid) => collection(db, `artifacts/${appId}/users/${uid}/finance`);

// Elementos DOM principais
const mainContent = document.getElementById('main-content');
const productsTableBody = document.getElementById('products-table-body');
const employeesTableBody = document.getElementById('employees-table-body');
const chatMessagesDiv = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendAiQueryBtn = document.getElementById('send-ai-query-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Mapas de elementos para acesso fácil
const navButtons = {
    'dashboard': document.getElementById('nav-dashboard'),
    'products': document.getElementById('nav-products'),
    'employees': document.getElementById('nav-employees'),
    'ai': document.getElementById('nav-ai'),
};

const dashboardElements = {}; // Para elementos do dashboard renderizados dinamicamente


// --- Funções de Autenticação e Inicialização ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        console.log("Usuário autenticado:", userId);
    } else {
        console.log("Nenhum usuário autenticado. Tentando autenticação anônima...");
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
                userId = auth.currentUser.uid;
                console.log("Autenticado com token personalizado:", userId);
            } else {
                await signInAnonymously(auth);
                userId = auth.currentUser.uid;
                console.log("Autenticado anonimamente:", userId);
            }
        } catch (error) {
            console.error("Erro na autenticação:", error);
            showMessageModal("Erro de Autenticação", "Não foi possível autenticar o usuário. Por favor, tente novamente.");
        }
    }
    isAuthReady = true;
    if (userId) {
        const userIdDisplay = document.getElementById('user-id-display');
        if (userIdDisplay) {
            userIdDisplay.textContent = `ID do Usuário: ${userId}`;
            userIdDisplay.classList.remove('hidden');
        }
        setupRealtimeListeners();
        loadPage('dashboard'); // Carrega o dashboard como página inicial
    }
});

// Configura os listeners de tempo real para as coleções
function setupRealtimeListeners() {
    if (!isAuthReady || !userId) {
        console.warn("Autenticação não pronta ou userId não definido para configurar listeners.");
        return;
    }

    onSnapshot(getProductsCollectionRef(userId), (snapshot) => {
        const products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        // Apenas atualiza o display se estivermos na página de produtos ou dashboard
        if (mainContent.querySelector('#products-table-body')) {
            displayProducts(products);
        }
        if (mainContent.querySelector('#section-dashboard')) {
            updateDashboardMetrics(products);
            updateReorderSuggestions(products);
        }
    }, (error) => {
        console.error("Erro ao obter produtos em tempo real:", error);
        showMessageModal("Erro", "Não foi possível carregar os produtos em tempo real.");
    });

    onSnapshot(getEmployeesCollectionRef(userId), (snapshot) => {
        const employees = [];
        snapshot.forEach(doc => {
            employees.push({ id: doc.id, ...doc.data() });
        });
        if (mainContent.querySelector('#employees-table-body')) {
            displayEmployees(employees);
        }
    }, (error) => {
        console.error("Erro ao obter funcionários em tempo real:", error);
        showMessageModal("Erro", "Não foi possível carregar os funcionários em tempo real.");
    });

    onSnapshot(getSalesCollectionRef(userId), (snapshot) => {
        if (mainContent.querySelector('#section-dashboard')) {
            // Re-fetch products to trigger full dashboard update, including sales
            getDocs(getProductsCollectionRef(userId)).then(productsSnapshot => {
                const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateDashboardMetrics(products);
            }).catch(error => console.error("Erro ao re-obter produtos para dashboard:", error));
        }
    }, (error) => {
        console.error("Erro ao obter vendas em tempo real:", error);
    });
}


// --- Funções de Navegação e Carregamento de Página ---
function loadPage(pageName) {
    mainContent.innerHTML = ''; // Limpa o conteúdo existente

    // Atualiza o estado ativo dos botões de navegação
    for (const key in navButtons) {
        if (navButtons[key]) { // Verifica se o botão existe
            navButtons[key].classList.remove('active');
        }
    }
    if (navButtons[pageName]) {
        navButtons[pageName].classList.add('active');
    }

    // Fecha a sidebar em mobile ao navegar
    closeMobileSidebar();

    // Renderiza o conteúdo da página
    if (pageName === 'dashboard') {
        renderDashboardPage();
    } else if (pageName === 'products') {
        renderProductsPage();
    } else if (pageName === 'employees') {
        renderEmployeesPage();
    } else if (pageName === 'ai') {
        renderAIAssistantPage();
    } else if (pageName === 'customers') {
        renderCustomersPage();
    } else if (pageName === 'suppliers') {
        renderSuppliersPage();
    } else if (pageName === 'finance') {
        renderFinancePage();
    }
    // As funções de display de dados e listeners específicos são chamadas dentro das funções de renderização de página
}

// Adiciona listeners aos botões de navegação da sidebar
navButtons.dashboard.addEventListener('click', () => loadPage('dashboard'));
navButtons.products.addEventListener('click', () => loadPage('products'));
navButtons.employees.addEventListener('click', () => loadPage('employees'));
navButtons.ai.addEventListener('click', () => loadPage('ai'));

// Adiciona listeners aos botões de navegação ERP
if (document.getElementById('nav-customers')) {
    document.getElementById('nav-customers').addEventListener('click', () => loadPage('customers'));
}
if (document.getElementById('nav-suppliers')) {
    document.getElementById('nav-suppliers').addEventListener('click', () => loadPage('suppliers'));
}
if (document.getElementById('nav-finance')) {
    document.getElementById('nav-finance').addEventListener('click', () => loadPage('finance'));
}

// --- Responsividade da Sidebar Mobile ---
mobileMenuButton.addEventListener('click', () => {
    sidebar.classList.toggle('hidden-mobile');
    sidebar.classList.toggle('visible-mobile');
    sidebarOverlay.classList.toggle('hidden');
});

sidebarOverlay.addEventListener('click', () => {
    closeMobileSidebar();
});

function closeMobileSidebar() {
    sidebar.classList.remove('visible-mobile');
    sidebar.classList.add('hidden-mobile');
    sidebarOverlay.classList.add('hidden');
}


// --- Funções do Modal ---
function openModal(modalId, title = '', content = '') {
    const modal = document.getElementById(modalId);
    if (modalId === 'product-modal') {
        document.getElementById('product-modal-title').textContent = title;
        if (title.includes('Adicionar')) {
            document.getElementById('product-form').reset();
            document.getElementById('product-id').value = '';
        }
    } else if (modalId === 'employee-modal') {
        document.getElementById('employee-modal-title').textContent = title;
        if (title.includes('Adicionar')) {
            document.getElementById('employee-form').reset();
            document.getElementById('employee-id').value = '';
        }
    } else if (modalId === 'customer-modal') {
        document.getElementById('customer-modal-title').textContent = title;
        if (title.includes('Adicionar')) {
            document.getElementById('customer-form').reset();
            document.getElementById('customer-id').value = '';
        }
    } else if (modalId === 'supplier-modal') {
        document.getElementById('supplier-modal-title').textContent = title;
        if (title.includes('Adicionar')) {
            document.getElementById('supplier-form').reset();
            document.getElementById('supplier-id').value = '';
        }
    } else if (modalId === 'finance-modal') {
        document.getElementById('finance-modal-title').textContent = title;
        if (title.includes('Novo Lançamento')) {
            document.getElementById('finance-form').reset();
            document.getElementById('finance-id').value = '';
        }
    } else if (modalId === 'message-modal') {
        document.getElementById('message-modal-title').textContent = title;
        document.getElementById('message-modal-content').textContent = content;

        const okButton = modal.querySelector('.btn-primary');
        let cancelButton = modal.querySelector('.btn-secondary');

        // Remove o botão cancelar existente se presente
        if (cancelButton) cancelButton.remove();

        if (content.includes("Tem certeza que deseja excluir")) {
            // Cria um novo botão cancelar
            cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'btn-secondary mr-3';
            cancelButton.textContent = 'Cancelar';
            cancelButton.onclick = () => closeModal(modalId);
            // Insere o botão cancelar antes do botão ok
            okButton.parentNode.insertBefore(cancelButton, okButton);

            okButton.classList.remove('btn-primary');
            okButton.classList.add('btn-danger');
            okButton.textContent = 'Sim, Excluir';
        } else {
            okButton.classList.remove('btn-danger');
            okButton.classList.add('btn-primary');
            okButton.textContent = 'Ok';
        }
    }
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 400); // Corresponde à duração da transição CSS
}

// Fecha modais ao clicar fora
window.addEventListener('click', (event) => {
    const modals = ['product-modal', 'employee-modal', 'customer-modal', 'supplier-modal', 'finance-modal', 'message-modal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        // Garante que o clique foi no overlay do modal e não dentro do conteúdo
        if (modal.classList.contains('show') && event.target === modal) {
            closeModal(modalId);
        }
    });
});

function showMessageModal(title, content) {
    openModal('message-modal', title, content);
}


// --- Funções de Renderização de Páginas (Conteúdo Dinâmico) ---

// Renderiza a página do Dashboard
function renderDashboardPage() {
    mainContent.innerHTML = `
        <div id="section-dashboard" class="card">
            <h2 class="section-title">
                <svg class="icon mr-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H2z"></path><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"></path></svg>
                Dashboard do Inventário
            </h2>
            <div class="dashboard-grid mb-8">
                <div class="dashboard-metric-card">
                    <h4>Total de Produtos</h4>
                    <p id="total-products-count">0</p>
                </div>
                <div class="dashboard-metric-card green">
                    <h4>Estoque Saudável</h4>
                    <p id="healthy-stock-count">0</p>
                </div>
                <div class="dashboard-metric-card red">
                    <h4>Estoque Baixo/Crítico</h4>
                    <p id="low-stock-count">0</p>
                </div>
                <div class="dashboard-metric-card">
                    <h4>Últimas Vendas (30 dias)</h4>
                    <p id="last-30-day-sales">0</p>
                </div>
            </div>

            <div class="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-200 shadow-inner">
                <h3 class="text-2xl font-bold text-primary-blue-dark mb-4 flex items-center">
                    <svg class="icon mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd"></path></svg>
                    Análise Preditiva e Reabastecimento (IA)
                </h3>
                <div id="reorder-suggestions" class="text-primary-blue-dark text-base leading-relaxed">
                    <p>A IA está analisando seus dados para gerar sugestões...</p>
                </div>
            </div>
        </div>
    `;
    // Mapeia os elementos do dashboard para acesso futuro
    dashboardElements['totalProductsCount'] = document.getElementById('total-products-count');
    dashboardElements['healthyStockCount'] = document.getElementById('healthy-stock-count');
    dashboardElements['lowStockCount'] = document.getElementById('low-stock-count');
    dashboardElements['last30DaySales'] = document.getElementById('last-30-day-sales');
    dashboardElements['reorderSuggestionsDiv'] = document.getElementById('reorder-suggestions');

    // Força a atualização das métricas e sugestões assim que a página é carregada
    if (userId) {
        getDocs(getProductsCollectionRef(userId)).then(productsSnapshot => {
            const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboardMetrics(products);
            updateReorderSuggestions(products);
        }).catch(error => console.error("Erro ao carregar dados para dashboard:", error));
    }
}

// Renderiza a página de Produtos
function renderProductsPage() {
    mainContent.innerHTML = `
        <div id="section-products" class="card">
            <h2 class="section-title">
                <svg class="icon mr-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM13 7a2 2 0 00-2-2h2a2 2 0 002 2V5a2 2 0 00-2-2h-2zM13 15a2 2 0 00-2-2h2a2 2 0 002 2v-2a2 2 0 00-2-2h-2z"></path></svg>
                Gerenciamento de Produtos
            </h2>
            <button id="add-product-btn" class="btn-primary mb-6 flex items-center">
                <svg class="icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
                Adicionar Produto
            </button>

            <div class="overflow-x-auto shadow-md rounded-xl border border-gray-100">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr class="table-header">
                            <th>Nome</th>
                            <th>Quantidade</th>
                            <th>Preço</th>
                            <th>Descrição</th>
                            <th>Última Venda</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="products-table-body" class="bg-white divide-y divide-gray-100">
                        <!-- As linhas de produtos serão inseridas dinamicamente aqui -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    // Re-atribui o productsTableBody (já que o conteúdo foi re-renderizado)
    // E re-atribui o listener ao botão de adicionar
    const addProductBtn = document.getElementById('add-product-btn');
    addProductBtn.addEventListener('click', () => openModal('product-modal', 'Adicionar Produto'));
    // E vincula o formulário de produto (que está no HTML global)
    document.getElementById('product-form').addEventListener('submit', handleProductFormSubmit);

    // Carrega e exibe os produtos assim que a página é renderizada
    if (userId) {
        getDocs(getProductsCollectionRef(userId)).then(productsSnapshot => {
            const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayProducts(products);
        }).catch(error => console.error("Erro ao carregar produtos para página:", error));
    }
}

// Renderiza a página de Funcionários
function renderEmployeesPage() {
    mainContent.innerHTML = `
        <div id="section-employees" class="card">
            <h2 class="section-title">
                <svg class="icon mr-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"></path></svg>
                Gerenciamento de Funcionários
            </h2>
            <button id="add-employee-btn" class="btn-primary mb-6 flex items-center">
                <svg class="icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
                Adicionar Funcionário
            </button>

            <div class="overflow-x-auto shadow-md rounded-xl border border-gray-100">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr class="table-header">
                            <th>Nome</th>
                            <th>Cargo</th>
                            <th>Contato</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="employees-table-body" class="bg-white divide-y divide-gray-100">
                        <!-- As linhas de funcionários serão inseridas dinamicamente aqui -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    // Re-atribui o employeesTableBody e o listener ao botão de adicionar
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    addEmployeeBtn.addEventListener('click', () => openModal('employee-modal', 'Adicionar Funcionário'));
    // E vincula o formulário de funcionário (que está no HTML global)
    document.getElementById('employee-form').addEventListener('submit', handleEmployeeFormSubmit);

    // Carrega e exibe os funcionários assim que a página é renderizada
    if (userId) {
        getDocs(getEmployeesCollectionRef(userId)).then(employeesSnapshot => {
            const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayEmployees(employees);
        }).catch(error => console.error("Erro ao carregar funcionários para página:", error));
    }
}

// Renderiza a página do Assistente de IA
function renderAIAssistantPage() {
    mainContent.innerHTML = `
        <div id="section-ai" class="card">
            <h2 class="section-title">
                <svg class="icon mr-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18.653 10.165A2.327 2.327 0 0017.332 9.2c-.65-.12-1.29-.46-1.84-1.01l-.81-1.01a1 1 0 00-1.54-.15l-.81-.81a1 1 0 00-1.15-1.54l-1.01-.81c-.55-.55-1.2-.89-1.84-1.01A2.327 2.327 0 0010 1.347v.01a1 1 0 00-1.01-.81L7.17 1a1 1 0 00-1.54 1.15l-.81 1.01c-.55.55-.89 1.2-1.01 1.84A2.327 2.327 0 001.347 10h.01a1 1 0 00-1.54 1.15l.81 1.01c.55.55.89 1.2 1.01 1.84A2.327 2.327 0 0010 18.653v-.01a1 1 0 001.01 1.54l1.01-.81c.55-.55.89-1.2 1.01-1.84A2.327 2.327 0 0018.653 10zm-8.48-1.564a1 1 0 00-.707-.707c-.4-.4-1.02-.4-1.42 0s-.4 1.02 0 1.42a1 1 0 00.707.707c.4.4 1.02.4 1.42 0s-.4-1.02 0-1.42z" clip-rule="evenodd"></path></svg>
                Assistente de IA
            </h2>
            <div class="chat-container mb-6" id="chat-messages">
                <!-- As mensagens do chat serão inseridas dinamicamente aqui -->
            </div>
            <div class="flex items-center">
                <input type="text" id="user-input" class="input-field flex-grow mr-4" placeholder="Pergunte algo ao assistente IA...">
                <button id="send-ai-query-btn" class="btn-primary flex items-center">
                    <svg class="icon mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l4.415-1.104a1 1 0 01.769 0l4.415 1.104a1 1 0 001.169-1.409l-7-14z"></path></svg>
                    Enviar
                </button>
            </div>
            <div id="loading-indicator" class="loading-indicator">
                <div class="loading-spinner"></div>
                <p>A IA está pensando...</p>
            </div>
        </div>
    `;
    // Re-atribui os elementos do chat e listeners
    // NOTA: Estas variáveis globais são re-atribuídas AQUI porque o DOM é recriado
    // e o `chatMessagesDiv` e `userInput` etc. originais se tornam obsoletos.
    window.chatMessagesDiv = document.getElementById('chat-messages'); // Torna global novamente para acesso
    window.userInput = document.getElementById('user-input');
    window.sendAiQueryBtn = document.getElementById('send-ai-query-btn');
    window.loadingIndicator = document.getElementById('loading-indicator');

    window.sendAiQueryBtn.addEventListener('click', sendAiQuery);
    window.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendAiQuery();
        }
    });

    // Garante que o histórico do chat seja exibido
    chatHistory.forEach(msg => addChatMessage(msg.parts[0].text, msg.role));
}

// Renderiza a página de Clientes
function renderCustomersPage() {
    mainContent.innerHTML = `
        <div id="section-customers" class="card">
            <h2 class="section-title">Clientes</h2>
            <button id="add-customer-btn" class="btn-primary mb-6 flex items-center">Adicionar Cliente</button>
            <div class="overflow-x-auto shadow-md rounded-xl border border-gray-100">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr class="table-header">
                            <th>Nome</th>
                            <th>Contato</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="customers-table-body" class="bg-white divide-y divide-gray-100">
                        <!-- As linhas de clientes serão inseridas dinamicamente aqui -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('add-customer-btn').addEventListener('click', () => openModal('customer-modal', 'Adicionar Cliente'));
    document.getElementById('customer-form').addEventListener('submit', handleCustomerFormSubmit);
    if (userId) {
        getDocs(getCustomersCollectionRef(userId)).then(snapshot => {
            const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayCustomers(customers);
        });
    }
}

// Renderiza a página de Fornecedores
function renderSuppliersPage() {
    mainContent.innerHTML = `
        <div id="section-suppliers" class="card">
            <h2 class="section-title">Fornecedores</h2>
            <button id="add-supplier-btn" class="btn-primary mb-6 flex items-center">Adicionar Fornecedor</button>
            <div class="overflow-x-auto shadow-md rounded-xl border border-gray-100">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr class="table-header">
                            <th>Nome</th>
                            <th>Contato</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="suppliers-table-body" class="bg-white divide-y divide-gray-100">
                        <!-- As linhas de fornecedores serão inseridas dinamicamente aqui -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('add-supplier-btn').addEventListener('click', () => openModal('supplier-modal', 'Adicionar Fornecedor'));
    document.getElementById('supplier-form').addEventListener('submit', handleSupplierFormSubmit);
    if (userId) {
        getDocs(getSuppliersCollectionRef(userId)).then(snapshot => {
            const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displaySuppliers(suppliers);
        });
    }
}

// Renderiza a página Financeira
function renderFinancePage() {
    mainContent.innerHTML = `
        <div id="section-finance" class="card">
            <h2 class="section-title">Financeiro</h2>
            <button id="add-finance-btn" class="btn-primary mb-6 flex items-center">Novo Lançamento</button>
            <div class="overflow-x-auto shadow-md rounded-xl border border-gray-100">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr class="table-header">
                            <th>Tipo</th>
                            <th>Descrição</th>
                            <th>Valor</th>
                            <th>Data</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="finance-table-body" class="bg-white divide-y divide-gray-100">
                        <!-- As linhas financeiras serão inseridas dinamicamente aqui -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('add-finance-btn').addEventListener('click', () => openModal('finance-modal', 'Lançamento Financeiro'));
    document.getElementById('finance-form').addEventListener('submit', handleFinanceFormSubmit);
    if (userId) {
        getDocs(getFinanceCollectionRef(userId)).then(snapshot => {
            const finances = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayFinance(finances);
        });
    }
}

// --- Funções CRUD e display para clientes, fornecedores e financeiro ---
function handleCustomerFormSubmit(e) {
    e.preventDefault();
    if (!userId) return;
    const id = document.getElementById('customer-id').value;
    const name = document.getElementById('customer-name').value.trim();
    const contact = document.getElementById('customer-contact').value.trim();
    const data = { name, contact, updatedAt: serverTimestamp() };
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Salvando...';
    (id ? setDoc(doc(getCustomersCollectionRef(userId), id), data, { merge: true }) : addDoc(getCustomersCollectionRef(userId), data))
        .then(() => { closeModal('customer-modal'); loadPage('customers'); })
        .finally(() => { btn.disabled = false; btn.textContent = 'Salvar'; });
}

function displayCustomers(customers) {
    const tbody = document.getElementById('customers-table-body');
    tbody.innerHTML = customers.length === 0 ? '<tr><td colspan="3" class="text-center text-text-light py-8">Nenhum cliente cadastrado.</td></tr>' : '';
    customers.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${c.name}</td><td>${c.contact || '-'}</td><td><button class="text-primary-blue" onclick="editCustomer('${c.id}')">Editar</button></td>`;
    });
}

window.editCustomer = async (id) => {
    if (!userId) return;
    const docSnap = await getDoc(doc(getCustomersCollectionRef(userId), id));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('customer-id').value = id;
        document.getElementById('customer-name').value = d.name;
        document.getElementById('customer-contact').value = d.contact;
        openModal('customer-modal', 'Editar Cliente');
    }
};

function handleSupplierFormSubmit(e) {
    e.preventDefault();
    if (!userId) return;
    const id = document.getElementById('supplier-id').value;
    const name = document.getElementById('supplier-name').value.trim();
    const contact = document.getElementById('supplier-contact').value.trim();
    const data = { name, contact, updatedAt: serverTimestamp() };
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Salvando...';
    (id ? setDoc(doc(getSuppliersCollectionRef(userId), id), data, { merge: true }) : addDoc(getSuppliersCollectionRef(userId), data))
        .then(() => { closeModal('supplier-modal'); loadPage('suppliers'); })
        .finally(() => { btn.disabled = false; btn.textContent = 'Salvar'; });
}

function displaySuppliers(suppliers) {
    const tbody = document.getElementById('suppliers-table-body');
    tbody.innerHTML = suppliers.length === 0 ? '<tr><td colspan="3" class="text-center text-text-light py-8">Nenhum fornecedor cadastrado.</td></tr>' : '';
    suppliers.forEach(s => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${s.name}</td><td>${s.contact || '-'}</td><td><button class="text-primary-blue" onclick="editSupplier('${s.id}')">Editar</button></td>`;
    });
}

window.editSupplier = async (id) => {
    if (!userId) return;
    const docSnap = await getDoc(doc(getSuppliersCollectionRef(userId), id));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('supplier-id').value = id;
        document.getElementById('supplier-name').value = d.name;
        document.getElementById('supplier-contact').value = d.contact;
        openModal('supplier-modal', 'Editar Fornecedor');
    }
};

function handleFinanceFormSubmit(e) {
    e.preventDefault();
    if (!userId) return;
    const id = document.getElementById('finance-id').value;
    const type = document.getElementById('finance-type').value;
    const desc = document.getElementById('finance-desc').value.trim();
    const value = parseFloat(document.getElementById('finance-value').value);
    const date = document.getElementById('finance-date').value;
    const data = { type, desc, value, date, updatedAt: serverTimestamp() };
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Salvando...';
    (id ? setDoc(doc(getFinanceCollectionRef(userId), id), data, { merge: true }) : addDoc(getFinanceCollectionRef(userId), data))
        .then(() => { closeModal('finance-modal'); loadPage('finance'); })
        .finally(() => { btn.disabled = false; btn.textContent = 'Salvar'; });
}

function displayFinance(finances) {
    const tbody = document.getElementById('finance-table-body');
    tbody.innerHTML = finances.length === 0 ? '<tr><td colspan="5" class="text-center text-text-light py-8">Nenhum lançamento financeiro.</td></tr>' : '';
    finances.forEach(f => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${f.type === 'receber' ? 'A Receber' : 'A Pagar'}</td><td>${f.desc}</td><td>R$ ${f.value.toFixed(2)}</td><td>${f.date}</td><td></td>`;
    });
}

// --- Gerenciamento de Produtos ---
// As funções de CRUD de produtos permanecem as mesmas, mas os listeners são re-anexados na renderização da página
async function handleProductFormSubmit(e) {
    e.preventDefault();
    if (!userId) { showMessageModal("Erro", "Usuário não autenticado. Por favor, aguarde."); return; }

    const productId = document.getElementById('product-id').value;
    const productName = document.getElementById('product-name').value.trim();
    const productQuantity = parseInt(document.getElementById('product-quantity').value);
    const productPrice = parseFloat(document.getElementById('product-price').value);
    const productDescription = document.getElementById('product-description').value.trim();

    if (!productName) { showMessageModal("Validação", "O nome do produto é obrigatório."); return; }
    if (isNaN(productQuantity) || productQuantity < 0) { showMessageModal("Validação", "Quantidade deve ser um número não negativo."); return; }
    if (isNaN(productPrice) || productPrice < 0) { showMessageModal("Validação", "Preço deve ser um número não negativo."); return; }

    const productData = {
        name: productName,
        quantity: productQuantity,
        price: productPrice,
        description: productDescription,
        updatedAt: serverTimestamp(),
        lastSoldDate: productId ? (await getDoc(doc(getProductsCollectionRef(userId), productId))).data().lastSoldDate : null // Preserve lastSoldDate on edit
    };

    const submitButton = document.getElementById('product-form').querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    try {
        if (productId) {
            await setDoc(doc(getProductsCollectionRef(userId), productId), productData, { merge: true });
            showMessageModal("Sucesso", "Produto atualizado com sucesso!");
        } else {
            await addDoc(getProductsCollectionRef(userId), productData);
            showMessageModal("Sucesso", "Produto adicionado com sucesso!");
        }
        closeModal('product-modal');
    } catch (error) {
        console.error("Erro ao salvar produto:", error);
        showMessageModal("Erro", "Não foi possível salvar o produto. " + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar';
    }
}

function displayProducts(products) {
    const tableBody = document.getElementById('products-table-body');
    if (!tableBody) return; // Garante que o elemento exista na página atual

    tableBody.innerHTML = '';
    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-row text-center text-text-light py-8">Nenhum produto cadastrado.</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = tableBody.insertRow();
        const quantityClass = product.quantity < 10 ? 'status-low-stock' : 'status-good-stock';
        row.innerHTML = `
            <td class="font-medium">${product.name}</td>
            <td class="${quantityClass}">${product.quantity}</td>
            <td>R$ ${product.price ? product.price.toFixed(2) : '0.00'}</td>
            <td class="max-w-xs overflow-hidden text-ellipsis">${product.description || '-'}</td>
            <td>${product.lastSoldDate ? new Date(product.lastSoldDate.toDate()).toLocaleDateString('pt-BR') : 'Nunca'}</td>
            <td class="space-x-2 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <button class="text-primary-blue hover:text-primary-blue-dark transition-colors" onclick="editProduct('${product.id}')">Editar</button>
                <button class="text-accent-green hover:text-green-600 transition-colors" onclick="sellProduct('${product.id}', '${product.name}')">Vender</button>
                <button class="text-alert-red hover:text-red-600 transition-colors" onclick="deleteProduct('${product.id}', '${product.name}')">Excluir</button>
            </td>
        `;
    });
}

// As funções editProduct, deleteProduct, sellProduct devem ser globais (ou anexadas ao window)
// para serem chamadas do HTML que é renderizado dinamicamente.
window.editProduct = async (id) => {
    if (!userId) { showMessageModal("Erro", "Usuário não autenticado."); return; }
    try {
        const productDoc = await getDoc(doc(getProductsCollectionRef(userId), id));
        if (productDoc.exists()) {
            const productData = productDoc.data();
            document.getElementById('product-id').value = id;
            document.getElementById('product-name').value = productData.name;
            document.getElementById('product-quantity').value = productData.quantity;
            document.getElementById('product-price').value = productData.price;
            document.getElementById('product-description').value = productData.description;
            openModal('product-modal', 'Editar Produto');
        } else {
            showMessageModal("Erro", "Produto não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao carregar produto para edição:", error);
        showMessageModal("Erro", "Não foi possível carregar o produto para edição. " + error.message);
    }
};

window.deleteProduct = async (id, name) => {
    if (!userId) { showMessageModal("Erro", "Usuário não autenticado."); return; }
    openModal('message-modal', 'Confirmar Exclusão', `Tem certeza que deseja excluir o produto "${name}"?`);
    const okButton = document.getElementById('message-modal').querySelector('.btn-danger'); // Agora é btn-danger
    okButton.onclick = async () => {
        okButton.disabled = true;
        okButton.textContent = 'Excluindo...';
        try {
            await deleteDoc(doc(getProductsCollectionRef(userId), id));
            closeModal('message-modal');
            showMessageModal("Sucesso", "Produto excluído com sucesso!");
        } catch (error) {
            console.error("Erro ao excluir produto:", error);
            closeModal('message-modal');
            showMessageModal("Erro", "Não foi possível excluir o produto. " + error.message);
        } finally {
            okButton.disabled = false;
        }
    };
};

window.sellProduct = async (productId, productName) => {
    if (!userId) { showMessageModal("Erro", "Usuário não autenticado."); return; }
    try {
        const productRef = doc(getProductsCollectionRef(userId), productId);
        const productDoc = await getDoc(productRef);
        if (productDoc.exists()) {
            const currentQuantity = productDoc.data().quantity;
            if (currentQuantity > 0) {
                const newQuantity = currentQuantity - 1;
                await updateDoc(productRef, {
                    quantity: newQuantity,
                    lastSoldDate: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                await addDoc(getSalesCollectionRef(userId), {
                    productId: productId,
                    productName: productName,
                    quantitySold: 1,
                    saleDate: serverTimestamp()
                });
                showMessageModal("Sucesso", `1 unidade de "${productName}" vendida. Novo estoque: ${newQuantity}.`);
            } else {
                showMessageModal("Aviso", `"${productName}" está fora de estoque.`);
            }
        } else {
            showMessageModal("Erro", "Produto não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao vender produto:", error);
        showMessageModal("Erro", "Não foi possível registrar a venda. " + error.message);
    }
};


// --- Gerenciamento de Funcionários ---
// As funções de CRUD de funcionários permanecem as mesmas, mas os listeners são re-anexados na renderização da página
async function handleEmployeeFormSubmit(e) {
    e.preventDefault();
    if (!userId) { showMessageModal("Erro", "Usuário não autenticado. Por favor, aguarde."); return; }

    const employeeId = document.getElementById('employee-id').value;
    const employeeName = document.getElementById('employee-name').value.trim();
    const employeeRole = document.getElementById('employee-role').value.trim();
    const employeeContact = document.getElementById('employee-contact').value.trim();

    if (!employeeName) { showMessageModal("Validação", "O nome do funcionário é obrigatório."); return; }
    if (!employeeRole) { showMessageModal("Validação", "O cargo do funcionário é obrigatório."); return; }

    const employeeData = {
        name: employeeName,
        role: employeeRole,
        contact: employeeContact,
        updatedAt: serverTimestamp()
    };

    const submitButton = document.getElementById('employee-form').querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    try {
        if (employeeId) {
            await setDoc(doc(getEmployeesCollectionRef(userId), employeeId), employeeData, { merge: true });
            showMessageModal("Sucesso", "Funcionário atualizado com sucesso!");
        } else {
            await addDoc(getEmployeesCollectionRef(userId), employeeData);
            showMessageModal("Sucesso", "Funcionário adicionado com sucesso!");
        }
        closeModal('employee-modal');
    } catch (error) {
        console.error("Erro ao salvar funcionário:", error);
        showMessageModal("Erro", "Não foi possível salvar o funcionário. " + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar';
    }
}

function displayEmployees(employees) {
    const tableBody = document.getElementById('employees-table-body');
    if (!tableBody) return; // Garante que o elemento exista na página atual

    tableBody.innerHTML = '';
    if (employees.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="table-row text-center text-text-light py-8">Nenhum funcionário cadastrado.</td></tr>';
        return;
    }

    employees.forEach(employee => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td class="font-medium">${employee.name}</td>
            <td>${employee.role}</td>
            <td>${employee.contact || '-'}</td>
            <td class="space-x-2 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <button class="text-primary-blue hover:text-primary-blue-dark transition-colors" onclick="editEmployee('${employee.id}')">Editar</button>
                <button class="text-alert-red hover:text-red-600 transition-colors" onclick="deleteEmployee('${employee.id}', '${employee.name}')">Excluir</button>
            </td>
        `;
    });
}

// As funções editEmployee, deleteEmployee devem ser globais
window.editEmployee = async (id) => {
    if (!userId) { showMessageModal("Erro", "Usuário não autenticado."); return; }
    try {
        const employeeDoc = await getDoc(doc(getEmployeesCollectionRef(userId), id));
        if (employeeDoc.exists()) {
            const employeeData = employeeDoc.data();
            document.getElementById('employee-id').value = id;
            document.getElementById('employee-name').value = employeeData.name;
            document.getElementById('employee-role').value = employeeData.role;
            document.getElementById('employee-contact').value = employeeData.contact;
            openModal('employee-modal', 'Editar Funcionário');
        } else {
            showMessageModal("Erro", "Funcionário não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao carregar funcionário para edição:", error);
        showMessageModal("Erro", "Não foi possível carregar o funcionário para edição. " + error.message);
    }
};

window.deleteEmployee = async (id, name) => {
    if (!userId) { showMessageModal("Erro", "Usuário não autenticado."); return; }
    openModal('message-modal', 'Confirmar Exclusão', `Tem certeza que deseja excluir o funcionário "${name}"?`);
    const okButton = document.getElementById('message-modal').querySelector('.btn-danger');
    okButton.onclick = async () => {
        okButton.disabled = true;
        okButton.textContent = 'Excluindo...';
        try {
            await deleteDoc(doc(getEmployeesCollectionRef(userId), id));
            closeModal('message-modal');
            showMessageModal("Sucesso", "Funcionário excluído com sucesso!");
        } catch (error) {
            console.error("Erro ao excluir funcionário:", error);
            closeModal('message-modal');
            showMessageModal("Erro", "Não foi possível excluir o funcionário. " + error.message);
        } finally {
            okButton.disabled = false;
        }
    };
};


// --- Funções de Dashboard e IA Preditiva ---
async function updateDashboardMetrics(products) {
    // Verifica se os elementos do dashboard estão presentes (se a página Dashboard está ativa)
    if (!dashboardElements.totalProductsCount) return;

    const total = products.length;
    const lowStockThreshold = 10;
    const low = products.filter(p => p.quantity < lowStockThreshold).length;
    const healthy = total - low;

    dashboardElements.totalProductsCount.textContent = total;
    dashboardElements.healthyStockCount.textContent = healthy;
    dashboardElements.lowStockCount.textContent = low;

    // Calcula as vendas dos últimos 30 dias
    const salesSnapshot = await getDocs(getSalesCollectionRef(userId));
    const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let totalSalesLast30Days = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    sales.forEach(sale => {
        if (sale.saleDate.toDate() >= thirtyDaysAgo) {
            totalSalesLast30Days += sale.quantitySold;
        }
    });
    dashboardElements.last30DaySales.textContent = totalSalesLast30Days;
}

async function updateReorderSuggestions(products) {
    if (!dashboardElements.reorderSuggestionsDiv || !userId) {
        // Se a div de sugestões não existe ou o usuário não está pronto, não faz nada
        return;
    }
    try {
        const salesSnapshot = await getDocs(getSalesCollectionRef(userId));
        const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const productSalesHistory = {};
        sales.forEach(sale => {
            const productId = sale.productId;
            const saleDate = sale.saleDate.toDate();
            const quantitySold = sale.quantitySold;

            if (!productSalesHistory[productId]) {
                productSalesHistory[productId] = [];
            }
            productSalesHistory[productId].push({ saleDate, quantitySold });
        });

        let suggestionsHtml = '<ul class="list-disc pl-5 space-y-2">';
        let hasSuggestions = false;
        const today = new Date();

        products.forEach(product => {
            const currentQuantity = product.quantity;
            const history = productSalesHistory[product.id] || [];

            let totalSoldLast30Days = 0;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);

            history.filter(sale => sale.saleDate >= thirtyDaysAgo)
                   .forEach(sale => {
                       totalSoldLast30Days += sale.quantitySold;
                   });

            const averageDailyConsumption = totalSoldLast30Days > 0 ? (totalSoldLast30Days / 30) : 0;
            const minStockThreshold = 10;
            const safetyStockDays = 7; // Dias de estoque de segurança
            const reorderPoint = Math.ceil(averageDailyConsumption * safetyStockDays);

            if (currentQuantity <= minStockThreshold || (averageDailyConsumption > 0 && currentQuantity <= reorderPoint)) {
                hasSuggestions = true;
                let suggestion = `<li><strong class="text-primary-blue-dark">${product.name}:</strong> Estoque atual: <span class="font-bold ${currentQuantity < 10 ? 'text-alert-red' : 'text-primary-blue'}">${currentQuantity}</span>. `;
                if (currentQuantity <= minStockThreshold) {
                    suggestion += `<span class="text-alert-red font-bold">Atenção: Estoque muito baixo!</span> `;
                }

                if (averageDailyConsumption > 0) {
                    const quantityToReorder = Math.max(Math.ceil(averageDailyConsumption * 14) - currentQuantity, 15);
                    suggestion += `Consumo diário estimado: ${averageDailyConsumption.toFixed(1)}. Sugerido reabastecer com cerca de <span class="font-bold text-accent-green">${quantityToReorder}</span> unidades.`;
                } else {
                    suggestion += `Histórico de vendas insuficiente para previsão detalhada. Considere reabastecer conforme necessário.`;
                }
                suggestionsHtml += suggestion + '</li>';
            }
        });

        if (hasSuggestions) {
            dashboardElements.reorderSuggestionsDiv.innerHTML = suggestionsHtml + '</ul>';
        } else {
            dashboardElements.reorderSuggestionsDiv.innerHTML = '<p class="text-primary-blue-dark">Nenhuma sugestão de reabastecimento no momento. Seu estoque parece estar em ordem ou o histórico de vendas é limitado.</p>';
        }

    } catch (error) {
        console.error("Erro ao gerar sugestões de reabastecimento:", error);
        dashboardElements.reorderSuggestionsDiv.innerHTML = '<p class="text-alert-red">Erro ao carregar sugestões de reabastecimento.</p>';
    }
}

// --- Assistente IA por Chat (Integração com Gemini API) ---
// O histórico do chat permanece global
const chatHistory = [{ role: "model", parts: [{ text: "Olá! Eu sou seu assistente de estoque inteligente. Estou aqui para ajudar com suas dúvidas sobre o inventário. Que tal perguntar: 'Quais produtos estão com estoque baixo?' ou 'Quantos [nome do produto] temos?'" }] }];

// Funções de chat (agora usam as variáveis globais re-atribuídas na renderização da página)
function addChatMessage(message, sender) {
    // Verifica se chatMessagesDiv foi re-atribuído
    if (!window.chatMessagesDiv) {
        console.error("chatMessagesDiv não está disponível. A página de IA pode não ter sido renderizada ainda.");
        return;
    }
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);

    const avatar = document.createElement('div');
    avatar.classList.add('chat-avatar');
    avatar.textContent = sender === 'user' ? 'Você' : 'IA';

    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble');
    bubble.textContent = message;

    if (sender === 'user') {
        messageElement.appendChild(bubble);
        messageElement.appendChild(avatar);
    } else {
        messageElement.appendChild(avatar);
        messageElement.appendChild(bubble);
    }

    window.chatMessagesDiv.appendChild(messageElement);
    window.chatMessagesDiv.scrollTop = window.chatMessagesDiv.scrollHeight;
}

async function sendAiQuery() {
    // Verifica se os elementos do chat estão disponíveis
    if (!window.userInput || !window.sendAiQueryBtn || !window.loadingIndicator) {
        console.error("Elementos do chat não disponíveis.");
        return;
    }

    const prompt = window.userInput.value.trim();
    if (!prompt) return;

    addChatMessage(prompt, 'user');
    window.userInput.value = '';
    window.loadingIndicator.style.display = 'flex';
    window.sendAiQueryBtn.disabled = true;
    window.userInput.disabled = true;

    try {
        const productsSnapshot = await getDocs(getProductsCollectionRef(userId));
        const products = productsSnapshot.docs.map(doc => doc.data());
        const productContext = products.map(p => `Nome: ${p.name}, Quantidade: ${p.quantity}, Preço: ${p.price}`).join('; ');

        const fullPrompt = `Você é um assistente de controle de estoque inteligente. Responda a perguntas sobre o estoque de forma concisa e útil. O estoque atual é: ${productContext}. Pergunta: ${prompt}`;

        chatHistory.push({ role: "user", parts: [{ text: fullPrompt }] });

        const payload = { contents: chatHistory };
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            addChatMessage(text, 'ai');
            chatHistory.push({ role: "model", parts: [{ text: text }] });
        } else {
            addChatMessage("Desculpe, não consegui gerar uma resposta. A estrutura da resposta da IA foi inesperada. Tente novamente com uma pergunta diferente.", 'ai');
            console.error("Estrutura de resposta da IA inesperada:", result);
        }
    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        addChatMessage("Ocorreu um erro ao se comunicar com a IA. Por favor, tente novamente mais tarde. Detalhes: " + error.message, 'ai');
    } finally {
        window.loadingIndicator.style.display = 'none';
        window.sendAiQueryBtn.disabled = false;
        window.userInput.disabled = false;
        window.userInput.focus();
    }
}

// Garante que os listeners sejam configurados após a autenticação
window.onload = function() {
    // A função onAuthStateChanged já cuida da chamada de setupRealtimeListeners e loadPage('dashboard')
};

