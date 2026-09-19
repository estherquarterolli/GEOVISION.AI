# 🛰️ GEOVISION.AI — Painel e Ferramentas de Administração

Esta pasta `/admin` centraliza todas as ferramentas e utilitários para gerenciamento do **GEOVISION.AI** (usuários, permissões, alertas, backups e banco de dados).

---

## 🔒 Segurança Máxima & Autenticação

O sistema possui duas camadas de acesso restrito e seguro:

1. **Portal Web Exclusivo (`/admin/login` e `/admin`)**:
   - Interface institucional dedicada para administradores e agentes da Defesa Civil.
   - Validação estrita de papéis (`admin`, `defesa_civil`).
   - Proteção contra força bruta com bloqueio temporário após 3 tentativas inválidas.
   - Rejeição automática e revogação imediata de token se contas de cidadãos tentarem o acesso.

2. **Console CLI Protegido (`admin/menu.py` ou `admin.bat`)**:
   - Exige autenticação por e-mail e senha com conferência direta via hash bcrypt no SQLite antes de liberar qualquer ação de gerenciamento.
   - Proteção com limite de 3 tentativas por sessão.

---

## 🚀 Como Iniciar

### 1. Menu Interativo (Recomendado)
Você pode abrir o console interativo visual executando:

- **Windows:** Duplo clique no arquivo `admin/admin.bat` ou pelo terminal:
  ```bash
  python admin/menu.py
  ```
- **Linux/macOS:**
  ```bash
  python3 admin/menu.py
  ```

---

## 🛠️ Comandos Diretos e Scripts

Se preferir rodar comandos específicos diretamente pelo terminal:

### 👤 1. Gerenciamento de Usuários (`gerenciar_usuarios.py`)

- **Listar usuários:**
  ```bash
  python admin/gerenciar_usuarios.py listar
  python admin/gerenciar_usuarios.py listar --busca maria
  ```

- **Criar ou promover usuário:**
  ```bash
  python admin/gerenciar_usuarios.py salvar --email admin@geovision.ai --nome "Admin Master" --papel admin
  ```
  *(Papéis disponíveis: `admin`, `defesa_civil`, `cidadao`)*

- **Alterar papel de um usuário existente:**
  ```bash
  python admin/gerenciar_usuarios.py papel admin@geovision.ai admin
  ```

- **Redefinir senha:**
  ```bash
  python admin/gerenciar_usuarios.py senha usuario@exemplo.com
  ```

- **Excluir usuário:**
  ```bash
  python admin/gerenciar_usuarios.py excluir usuario@exemplo.com --com-alertas
  ```

---

### 🚨 2. Gerenciamento de Alertas (`gerenciar_alertas.py`)

- **Listar alertas:**
  ```bash
  python admin/gerenciar_alertas.py listar
  python admin/gerenciar_alertas.py listar --status em_vistoria --risco alto
  ```

- **Ver detalhes completos de um alerta:**
  ```bash
  python admin/gerenciar_alertas.py ver <ID_DO_ALERTA>
  ```

- **Atualizar status e observação:**
  ```bash
  python admin/gerenciar_alertas.py status <ID_DO_ALERTA> resolvido --obs "Vistoria realizada no local."
  ```
  *(Status válidos: `processando`, `recebido`, `em_vistoria`, `resolvido`, `nao_procede`)*

- **Exportar alertas (CSV ou JSON):**
  ```bash
  python admin/gerenciar_alertas.py exportar --formato csv --saida admin/relatorio.csv
  python admin/gerenciar_alertas.py exportar --formato json --saida admin/relatorio.json
  ```

- **Excluir alerta de teste:**
  ```bash
  python admin/gerenciar_alertas.py excluir <ID_DO_ALERTA>
  ```

---

### 💾 3. Manutenção, Backups e Métricas (`backup_e_limpeza.py`)

- **Exibir painel de métricas do sistema:**
  ```bash
  python admin/backup_e_limpeza.py stats
  ```

- **Gerar backup consistente do banco SQLite:**
  ```bash
  python admin/backup_e_limpeza.py backup
  ```
  *(Os backups são salvos em `admin/backups/geovision_backup_YYYYMMDD_HHMMSS.db`)*

- **Verificar integridade do banco de dados:**
  ```bash
  python admin/backup_e_limpeza.py checar
  ```

- **Identificar e limpar fotos órfãs (não vinculadas a nenhum alerta):**
  ```bash
  # Apenas verificar
  python admin/backup_e_limpeza.py limpar

  # Remover arquivos órfãos
  python admin/backup_e_limpeza.py limpar --executar
  ```
