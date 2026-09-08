# ⚡ Comandos Rápidos para Atualizações

## 🚀 Atualizar Backend
```bash
cd C:\Users\luisz\Documents\escala\despesas\webapp\backend
railway up
```

## 🎨 Atualizar Frontend  
```bash
cd C:\Users\luisz\Documents\escala\despesas\webapp\frontend
railway up
```

## 🔄 Atualizar Ambos
```bash
cd C:\Users\luisz\Documents\escala\despesas\webapp
railway up
```

## 📊 Ver Logs
```bash
railway logs
```

## 🔍 Ver Deployments
```bash
railway deployments
```

## ⏪ Rollback
```bash
railway rollback <deployment-id>
```

## 📝 Notas Importantes

1. **Sempre teste localmente primeiro**
2. **Verifique variáveis de ambiente após atualizações**
3. **Monitore logs após cada deployment**
4. **Faça backup da base de dados regularmente**

## 🆘 Problemas Comuns

- **Backend não inicia**: Verifique logs e variáveis de ambiente
- **Frontend não conecta**: Verifique NEXT_PUBLIC_API_URL e CORS_ORIGIN
- **Email não funciona**: Verifique SENDGRID_API_KEY e logs

Para guia completo, veja `DEPLOYMENT_GUIDE.md`