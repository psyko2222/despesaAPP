# Integração Webapp ↔ App Android

Este documento explica como integrar a webapp Despesas com a app Android existente.

## 🎯 Objetivos da Integração

- ✅ **Partilha de dados** - Mesma base de dados para ambas as plataformas
- ✅ **Sincronização** - Dados atualizados em tempo real
- ✅ **Flexibilidade** - Utilizadores escolhem plataforma
- ✅ **Manutenção** - Atualizações num só lugar

## 🔗 Métodos de Integração

### Método 1: WebView na App Android (Mais Simples)

A app Android carrega a webapp num WebView, mantendo a interface nativa mas usando a webapp.

#### Passos de Implementação

1. **Adicionar dependência no build.gradle.kts**
```kotlin
dependencies {
    implementation("androidx.webkit:webkit:1.8.0")
}
```

2. **Criar WebViewActivity**
```kotlin
package pt.despesas.app

import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class WebViewActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        setContentView(webView)
        
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
        }
        
        webView.webViewClient = WebViewClient()
        
        // Carregar a webapp
        webView.loadUrl("https://tua-webapp.com")
    }
    
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
```

3. **Adicionar botão para abrir WebView no MainActivity**
```kotlin
// No MainActivity.kt
FloatingActionButton(
    onClick = { startActivity(Intent(this, WebViewActivity::class.java)) }
) {
    Icon(Icons.Default.Public, "Abrir versão web")
}
```

#### Vantagens
- ✅ Implementação rápida
- ✅ Interface nativa mantida
- ✅ Webapp atualizada automaticamente

#### Desvantagens
- ⚠️ Dependência de conexão internet
- ⚠️ Performance inferior à nativa

---

### Método 2: API Calls Partilhadas (Recomendado)

App Android e webapp usam a mesma API REST, mantendo interfaces separadas mas dados sincronizados.

#### Passos de Implementação

1. **Adicionar dependências HTTP no build.gradle.kts**
```kotlin
dependencies {
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
```

2. **Criar API Service**
```kotlin
package pt.despesas.app.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

data class Expense(
    val id: Long = 0,
    val description: String,
    val amount_cents: Long,
    val debit_date: String,
    val paid: Boolean = false,
    val recurring: Boolean = false,
    // ... outros campos
)

data class AuthResponse(
    val token: String,
    val user: User
)

interface DespesasAPI {
    @POST("/api/auth/login")
    suspend fun login(@Body credentials: LoginRequest): AuthResponse
    
    @GET("/api/expenses/month/{month}")
    suspend fun getExpenses(@Path("month") month: String): List<Expense>
    
    @POST("/api/expenses")
    suspend fun createExpense(@Body expense: Expense): Expense
    
    // ... outros endpoints
}

object APIClient {
    private const val BASE_URL = "https://tua-api.com/"
    
    val api: DespesasAPI by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(DespesasAPI::class.java)
    }
}
```

3. **Modificar ExpenseDatabase para usar API**
```kotlin
class ExpenseDatabase(private val context: Context) {
    private val api = APIClient.api
    private var token: String? = null
    
    fun setToken(token: String) {
        this.token = token
    }
    
    suspend fun expensesFor(month: YearMonth): List<Expense> {
        return try {
            api.getExpenses(month.toString())
        } catch (e: Exception) {
            // Fallback para local se API falhar
            localExpensesFor(month)
        }
    }
    
    suspend fun save(expense: Expense): Long {
        return try {
            val result = api.createExpense(expense)
            // Também guardar localmente para offline
            localSave(expense)
            result.id
        } catch (e: Exception) {
            localSave(expense)
        }
    }
    
    // ... métodos locais para fallback
}
```

4. **Adicionar selector de modo no MainActivity**
```kotlin
var useWebMode by remember { mutableStateOf(false) }

Row {
    Button(onClick = { useWebMode = false }) {
        Text("Modo Local")
    }
    Button(onClick = { useWebMode = true }) {
        Text("Modo Web")
    }
}

if (useWebMode) {
    WebViewScreen()
} else {
    LocalScreen()
}
```

#### Vantagens
- ✅ Interface nativa mantida
- ✅ Dados sincronizados
- ✅ Funciona offline (com fallback)
- ✅ Melhor performance

#### Desvantagens
- ⚠️ Implementação mais complexa
- ⚠️ Requer backend sempre online

---

### Método 3: Híbrido (Flexível)

Utilizadores podem escolher entre versão nativa ou web, com migração de dados.

#### Passos de Implementação

1. **Adicionar opção nas definições**
```kotlin
// Em SettingsScreen.kt
var syncMode by remember { mutableStateOf("local") }

OutlinedButton(
    onClick = { syncMode = if (syncMode == "local") "web" else "local" }
) {
    Text("Modo: ${if (syncMode == "local") "Local" else "Web"}")
}
```

2. **Migração de dados**
```kotlin
suspend fun migrateToWeb() {
    val localExpenses = db.exportRows()
    try {
        APIClient.api.importBackup(localExpenses)
        Toast.makeText(context, "Dados migrados com sucesso", Toast.LENGTH_SHORT).show()
    } catch (e: Exception) {
        Toast.makeText(context, "Erro na migração", Toast.LENGTH_SHORT).show()
    }
}
```

3. **Sincronização bidirecional**
```kotlin
suspend fun syncData() {
    val localData = db.exportRows()
    val webData = APIClient.api.exportBackup()
    
    // Merge inteligente dos dados
    val merged = mergeData(localData, webData)
    
    // Atualizar ambos
    db.restoreRows(merged)
    APIClient.api.importBackup(merged)
}
```

#### Vantagens
- ✅ Máxima flexibilidade
- ✅ Utilizador escolhe
- ✅ Migração fácil

#### Desvantagens
- ⚠️ Implementação mais complexa
- ⚠️ Conflitos de dados possíveis

---

## 🚀 Deploy da Webapp

### Backend (Render/Vercel/Heroku)

1. **Preparar para produção**
```bash
cd backend
npm install
npm run build
```

2. **Configurar variáveis de ambiente**
```
PORT=3000
JWT_SECRET=seu-secret-seguro
DATABASE_PATH=/tmp/despesas.db
CORS_ORIGIN=https://tua-webapp.com,https://app-android.com
```

3. **Deploy**
```bash
# Render
render deploy

# Vercel (como serverless function)
vercel deploy

# Heroku
git push heroku main
```

### Frontend (Vercel/Netlify)

1. **Build para produção**
```bash
cd frontend
npm run build
```

2. **Configurar variáveis de ambiente**
```
NEXT_PUBLIC_API_URL=https://tua-api.com
```

3. **Deploy**
```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod
```

---

## 🔐 Segurança na Integração

### Autenticação
- Usar JWT tokens em ambas as plataformas
- Tokens com expiração de 7 dias
- Refresh tokens opcionais

### HTTPS
- **Obrigatório** para produção
- Certificados SSL válidos
- Criptografia de dados em trânsito

### CORS
- Configurar apenas domínios permitidos
- Usar credenciais quando necessário
- Validar origin headers

---

## 📱 Testes de Integração

### Testar WebView
```kotlin
@Test
fun testWebViewLoads() {
    val activity = rule.launchActivity(WebViewActivity::class.java)
    onView(withId(R.id.webview)).check(matches(isDisplayed()))
}
```

### Testar API Calls
```kotlin
@Test
fun testAPIConnection() = runBlocking {
    val result = APIClient.api.getExpenses("2024-01")
    assertNotNull(result)
}
```

### Testar Sincronização
```kotlin
@Test
fun testDataSync() = runBlocking {
    val local = db.exportRows()
    val web = APIClient.api.exportBackup()
    assertEquals(local.size(), web.size())
}
```

---

## 🎯 Recomendações

### Para Começar
1. **Método 1 (WebView)** - Se quiseres rápido e simples
2. **Método 2 (API)** - Se quiseres melhor performance e sincronização
3. **Método 3 (Híbrido)** - Se quiseres máxima flexibilidade

### Roadmap Sugerida
1. **Fase 1**: Implementar backend e webapp
2. **Fase 2**: Testar webapp em produção
3. **Fase 3**: Implementar integração WebView
4. **Fase 4**: Adicionar API calls na app Android
5. **Fase 5**: Implementar sincronização bidirecional

---

## 📞 Suporte

Para questões sobre integração, consulta:
- Documentação do backend: `/backend/README.md`
- Documentação do frontend: `/frontend/README.md`
- Código da app Android existente
