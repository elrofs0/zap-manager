# 🟢 ZapManager — Gestão de Entregas e Escalas via WhatsApp

Sistema completo de gerenciamento de entregas, escalas de funcionários e comunicação via WhatsApp, com assistente de IA integrado.

---

## 📋 Pré-requisitos

Antes de iniciar, certifique-se de ter instalado:

- **Docker** (versão 20+) e **Docker Compose** (v2+)
- Um **número de WhatsApp** para conectar à Evolution API
- (Opcional) Uma chave de API da **OpenAI** para o assistente de IA

---

## ⚙️ Configuração

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd zap-manager
```

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha cada variável:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

| Variável | Descrição | Exemplo |
|----------|-----------|----------|
| `NODE_ENV` | Ambiente de execução | `production` |
| `PORT` | Porta do servidor backend | `3000` |
| `DATABASE_URL` | URL de conexão do PostgreSQL | `postgresql://user:pass@db:5432/zapmanager` |
| `JWT_SECRET` | Chave secreta para tokens JWT (use uma string longa e aleatória) | `minha-chave-secreta-super-segura-123` |
| `EVOLUTION_API_URL` | URL da sua instância da Evolution API | `http://evolution:8080` |
| `EVOLUTION_API_KEY` | Chave de API da Evolution API | `sua-chave-evolution` |
| `EVOLUTION_INSTANCE` | Nome da instância WhatsApp na Evolution API | `zapmanager` |
| `OPENAI_API_KEY` | Chave de API da OpenAI (para assistente IA) | `sk-...` |
| `VITE_API_URL` | URL do backend para o frontend | `http://localhost:3000` |
| `REDIS_URL` | URL de conexão do Redis (para filas e cache) | `redis://redis:6379` |

---

## 🚀 Subir o Sistema

### Com Docker Compose (recomendado)

```bash
docker-compose up --build
```

Isso irá iniciar todos os serviços:
- **Frontend** → `http://localhost` (porta 80)
- **Backend/API** → `http://localhost:3000`
- **PostgreSQL** → porta 5432
- **Redis** → porta 6379
- **Evolution API** → `http://localhost:8080`

### Para desenvolvimento local

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

O frontend estará disponível em `http://localhost:5173`.

---

## 🔐 Login Padrão

Após a primeira execução, use as credenciais padrão para acessar o sistema:

| Campo | Valor |
|-------|-------|
| **E-mail** | `admin@admin.com` |
| **Senha** | `admin123` |

> ⚠️ **Importante:** Altere a senha padrão após o primeiro acesso em ambiente de produção!

---

## 📱 Configurar Webhook da Evolution API

Para receber mensagens do WhatsApp, configure o webhook da Evolution API:

### 1. Acessar o painel da Evolution API

Acesse `http://SEU_SERVIDOR:8080` e faça login.

### 2. Configurar o webhook

Na configuração da sua instância, defina a URL do webhook:

```
http://SEU_SERVIDOR/api/webhook/whatsapp
```

Ou, se estiver usando Docker Compose na mesma rede:

```
http://backend:3000/api/webhook/whatsapp
```

### 3. Eventos do webhook

Habilite os seguintes eventos:
- `MESSAGES_UPSERT` — Receber novas mensagens
- `MESSAGES_UPDATE` — Atualização de status de mensagens
- `CONNECTION_UPDATE` — Status da conexão WhatsApp

### 4. Conectar o WhatsApp

Escaneie o QR Code na Evolution API com o WhatsApp do número que será usado pelo sistema.

---

## 💬 Referência de Comandos WhatsApp

### 👑 Dono / Gerente

| Comando | Descrição |
|---------|----------|
| `nova entrega` | Inicia o fluxo interativo para criar uma nova entrega. O bot vai solicitar: descrição da rota, valor, nome do cliente e modo de atribuição (rodízio ou mais próximo). |
| `escalar [nome] [data] [horário] [tarefa]` | Cria uma escala diretamente. Exemplo: `escalar João 25/12 08:00-17:00 Cozinha` |
| `relatorio` | Recebe um resumo das entregas e escalas do dia |

### 🏍️ Motoboy

| Comando | Descrição |
|---------|----------|
| `disponivel` | Marca o motoboy como disponível para receber entregas |
| `ocupado` | Marca o motoboy como ocupado (não receberá novas atribuições) |
| *(Botão) Aceitar* | Aceita uma entrega atribuída |
| *(Botão) Recusar* | Recusa uma entrega atribuída (será redirecionada para outro motoboy) |
| *(Botão) Entregue* | Confirma que a entrega foi realizada |

### 👷 Funcionário

| Comando | Descrição |
|---------|----------|
| `vou faltar DD/MM` | Informa ausência na data especificada. Exemplo: `vou faltar 25/12` |
| *(Botão) Confirmar* | Confirma presença em uma escala atribuída |
| *(Botão) Trocar* | Solicita troca de turno com outro funcionário |

---

## 🗂️ Estrutura do Projeto

```
zap-manager/
├── backend/              # API Node.js + Express
│   ├── src/
│   │   ├── routes/       # Rotas da API
│   │   ├── services/     # Lógica de negócio
│   │   ├── models/       # Modelos do banco
│   │   └── middleware/    # Autenticação, etc.
│   ├── package.json
│   └── Dockerfile
├── frontend/             # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/        # Páginas da aplicação
│   │   ├── components/   # Componentes reutilizáveis
│   │   ├── context/      # Context API (Auth)
│   │   ├── hooks/        # Custom hooks (Socket)
│   │   └── api/          # Configuração Axios
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 📄 Páginas do Frontend

| Rota | Página | Descrição |
|------|--------|----------|
| `/` | Dashboard | Visão geral com mapa, estatísticas e entregas recentes |
| `/entregas` | Entregas | Lista completa de entregas com filtros e criação |
| `/escalas` | Escalas | Calendário semanal de turnos dos funcionários |
| `/funcionarios` | Funcionários | Gestão de funcionários e motoboys |
| `/assistente` | Assistente IA | Chat com IA para sugestões e automações |
| `/login` | Login | Tela de autenticação |

---

## 🛠️ Troubleshooting

### O frontend não carrega
- Verifique se o container do frontend está rodando: `docker-compose ps`
- Confira os logs: `docker-compose logs frontend`

### Não recebo mensagens do WhatsApp
- Verifique se o webhook está configurado corretamente na Evolution API
- Confira se a instância está conectada (QR Code escaneado)
- Veja os logs do backend: `docker-compose logs backend`

### Erro de conexão com banco de dados
- Verifique se o PostgreSQL está rodando: `docker-compose ps db`
- Confira a variável `DATABASE_URL` no `.env`

### Assistente IA não responde
- Verifique se a variável `OPENAI_API_KEY` está configurada no `.env`
- Confira se há créditos disponíveis na conta da OpenAI

---

## 📜 Licença

Este projeto é privado e de uso interno.
