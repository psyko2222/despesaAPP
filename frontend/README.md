# Despesas Frontend

Frontend Next.js para a aplicação Despesas, compatível com Android, iOS e Web.

## Funcionalidades

- ✅ Login e registo de utilizadores
- ✅ Gestão de despesas por mês
- ✅ Despesas recorrentes
- ✅ Navegação por períodos financeiros
- ✅ Interface responsiva (mobile-first)
- ✅ Design moderno com Tailwind CSS
- ✅ Compatível com iOS, Android e Web

## Instalação

```bash
npm install
```

## Configuração

1. Copiar `.env.local.example` para `.env.local`:
```bash
cp .env.local.example .env.local
```

2. Editar `.env.local` com a URL da API:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Executar

### Modo desenvolvimento
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

### Modo produção
```bash
npm run build
npm start
```

## Tecnologias

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Axios** - Cliente HTTP
- **Lucide React** - Ícones
- **date-fns** - Manipulação de datas

## Estrutura

```
src/
├── app/              # Next.js App Router
│   ├── login/       # Página de login
│   ├── page.tsx     # Página principal
│   ├── layout.tsx   # Layout global
│   └── globals.css  # Estilos globais
├── components/      # Componentes React
│   └── ui/          # Componentes UI reutilizáveis
├── hooks/           # Custom hooks
├── lib/             # Utilitários e API
├── types/           # Definições TypeScript
```

## Compatibilidade

- ✅ **iOS** - Safari, Chrome (PWA suportado)
- ✅ **Android** - Chrome, Firefox (PWA suportado)
- ✅ **Desktop** - Chrome, Firefox, Safari, Edge
- ✅ **Tablets** - iPad, Android tablets

## PWA (Progressive Web App)

Para transformar em PWA (instalável):

1. Adicionar manifest.json
2. Configurar service workers
3. Adicionar meta tags para iOS

## Integração com App Android

A webapp pode ser integrada na app Android através de:

1. **WebView** - Carregar a webapp dentro da app nativa
2. **API Calls** - App nativa faz chamadas à mesma API

Ver documentação de integração em `/webapp/INTEGRATION.md`
