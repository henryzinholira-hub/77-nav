# NIGHTCITY//NAV — Hortolândia

GPS estilo HUD de Cyberpunk 2077 para Android: mapa neon, rota com voz em português, alertas de radar e reportes estilo Waze.

## Como gerar o APK (sem instalar nada no PC)

1. Crie uma conta em **github.com** (grátis) e clique em **New repository** → nome `nightcity-nav` → **Create**.
2. Na página do repositório vazio, clique em **uploading an existing file**.
3. Descompacte o `.zip` no computador e **arraste o CONTEÚDO da pasta** `nightcity-nav` (as pastas `app`, `.github` e os arquivos `.kts`) para a página. Clique em **Commit changes**.
   - Se a pasta `.github` não subir (alguns sistemas escondem pastas com ponto): vá em **Actions → set up a workflow yourself**, apague o que aparecer, cole o conteúdo de `.github/workflows/build-apk.yml` e clique **Commit**.
4. Abra a aba **Actions**. O robô "Build APK" começa sozinho (leva ~4 min). Bolinha verde = pronto.
5. Clique na execução → no fim da página, em **Artifacts**, baixe **NightCityNav-APK** (vem um .zip com o `.apk` dentro).
6. Passe o `.apk` para o celular, abra e permita **"Instalar apps desconhecidos"**. Aceite a permissão de localização.

> Alternativa: abrir a pasta no **Android Studio** e clicar ▶ Run.

## Funções

| Função | Como usar |
|---|---|
| Rota até um endereço | Digite na busca e toque no resultado → **INICIAR** |
| Rota até um ponto | Toque longo no mapa → **ROTA ATÉ AQUI** |
| Marcar radar / polícia / acidente / buraco | Toque longo no mapa → escolha o tipo |
| Remover uma marcação sua | Toque no ícone → **REMOVER** |
| Atualizar radares do OpenStreetMap | Botão ⟳ |
| Trocar tema (vermelho Arasaka / ciano Netrunner) | Botão ◐ |
| Silenciar voz | Botão 🔊 |

## De onde vêm os dados (tudo grátis, sem chave)

- **Mapa:** OpenStreetMap + CARTO (estilo escuro, recolorido em neon pelo app)
- **Radares:** OpenStreetMap (Overpass). Hortolândia pode ter poucos mapeados — marque os que você conhece com toque longo; eles ficam salvos no celular.
- **Busca de endereço:** Nominatim
- **Rotas e manobras:** OSRM (servidor público de demonstração)

## Limites desta versão

- Não tem trânsito em tempo real (isso exige Google/Waze pagos).
- Suas marcações ficam só no seu celular (não são compartilhadas com outras pessoas).
- O mapa fica com o Norte para cima (a seta gira); a navegação para quando o app sai da tela.
- O servidor público do OSRM é para uso leve/pessoal.

## Estrutura

```
app/src/main/assets/   ← interface (index.html, style.css, app.js) — edite aqui o visual e a lógica
app/src/main/java/...  ← MainActivity.java: GPS nativo, voz, vibração, tela acesa
.github/workflows/     ← robô que compila o APK
```
