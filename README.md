# Inventário Inteligente – Sistema Completo de Controle de Estoque

## Visão Geral

Este é um sistema web completo para controle de estoque, equipe e vendas, com dashboard, assistente IA e integração com banco de dados Firebase Firestore. O projeto é responsivo, moderno e pronto para uso real em empresas de qualquer porte.

## Funcionalidades

- **Dashboard**: Métricas em tempo real, análise preditiva e sugestões de reabastecimento.
- **Controle de Estoque**: Cadastro, edição, exclusão, venda e visualização de produtos.
- **Gestão de Equipe**: Cadastro, edição e exclusão de funcionários.
- **Assistente IA**: Chat inteligente para dúvidas sobre o estoque.
- **Interface moderna**: Sidebar, modais, responsividade e visual profissional.

## Estrutura do Projeto

- `index.html` – Página principal (SPA) com navegação dinâmica.
- `dashboard.html`, `estoque.html`, `equipe.html`, `assistente.html` – Páginas alternativas (opcional, pode usar só o index.html).
- `script.js` – Toda a lógica de CRUD, integração com Firebase e renderização dinâmica.
- `style.css` – Visual moderno com Tailwind CSS e customizações.

## Como Rodar Localmente

1. **Abra o projeto no VS Code**
2. Instale a extensão [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) (já instalada na maioria dos ambientes).
3. Clique com o botão direito em `index.html` e selecione **Open with Live Server**.
4. O site abrirá no navegador e recarregará automaticamente a cada alteração.

## Como Configurar o Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Ative o Firestore Database (modo test para desenvolvimento).
3. No menu "Configurações do Projeto" > "Suas apps", adicione um app web e copie o objeto de configuração do Firebase.
4. No arquivo `script.js`, substitua a variável `firebaseConfig` pelo seu objeto de configuração:

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

5. Pronto! O sistema já estará integrado ao seu banco de dados na nuvem.

## Observações
- O sistema funciona como SPA (Single Page Application) usando apenas o `index.html`.
- As páginas separadas (`dashboard.html`, etc) são opcionais e usam a mesma estrutura dinâmica.
- Todos os dados são salvos e lidos em tempo real do Firestore.
- O assistente IA pode ser integrado à API Gemini/Google (adicione sua chave no `script.js` se desejar usar IA real).

## Licença

Este projeto é livre para uso e customização.