import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const erros = []
page.on('console', (msg) => {
  if (msg.type() === 'error') erros.push(msg.text())
})
page.on('pageerror', (err) => erros.push(String(err)))

async function ir(caminho, nomeArquivo) {
  await page.goto(`http://localhost:5180${caminho}`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `_shot-${nomeArquivo}.png` })
  console.log(`OK ${caminho} -> _shot-${nomeArquivo}.png`)
}

// 1. Raiz sem sessão deve redirecionar para /entrar
await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' })
console.log('URL apos / :', page.url())
await page.screenshot({ path: '_shot-raiz.png' })

// 2. Cadastro (sem Supabase configurado -> aviso de configuração pendente)
await ir('/cadastro', 'cadastro-sem-config')

// 3. Login (mesma coisa)
await ir('/entrar', 'entrar-sem-config')

// 4. Termos de uso (não depende de conta)
await ir('/termos', 'termos')

// 5. Perfil protegido, sem sessão -> deve ir para /entrar OU mostrar aviso
await ir('/perfil', 'perfil-protegido')
console.log('URL apos /perfil :', page.url())

// 6. Vitrine do design system continua funcionando
await ir('/design-system', 'design-system')

console.log('ERROS_CONSOLE:', JSON.stringify(erros))
await browser.close()
