/**
 * Conteúdo espelha planodedesenvolvimento.md § 5 ("Termos e Condições de Uso
 * — base"). É rascunho para revisão jurídica antes de publicar — ver o aviso
 * no topo do próprio plano. Qualquer alteração no texto legal deve ser feita
 * nos dois lugares, ou o plano vira a fonte desatualizada.
 */
const ARTIGOS = [
  {
    titulo: '1. Objeto',
    texto:
      'O GeoVision.AI é uma plataforma de apoio à triagem de riscos estruturais (rachaduras, inclinações de muros de arrimo, infiltrações), desenvolvida no âmbito do Programa Jovens Cientistas Cariocas 2026. O sistema não substitui vistoria técnica oficial, laudo de engenharia ou avaliação humana da Defesa Civil — a classificação de risco gerada por Inteligência Artificial é uma estimativa de apoio à priorização.',
  },
  {
    titulo: '2. Cadastro',
    texto:
      'Para usar o sistema, o usuário deve fornecer nome, e-mail e bairro de residência. O usuário é responsável pela veracidade dos dados informados e pela guarda de sua senha.',
  },
  {
    titulo: '3. Coleta e uso de dados',
    texto:
      'Ao enviar um alerta, o usuário compartilha: (a) uma fotografia da anomalia estrutural; (b) sua geolocalização no momento do envio; (c) data e hora do registro. Esses dados são usados exclusivamente para: classificação automática de risco, encaminhamento à Defesa Civil e geração de mapas agregados de risco por região. Não são vendidos ou compartilhados com terceiros fora dessa finalidade.',
  },
  {
    titulo: '4. Base legal e LGPD',
    texto:
      'O tratamento de dados segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), com base no consentimento do usuário e no legítimo interesse público de prevenção de desastres. O usuário pode, a qualquer momento, solicitar acesso, correção ou exclusão de seus dados pelo contato abaixo.',
  },
  {
    titulo: '5. Limitação de responsabilidade',
    texto:
      'A classificação de risco é gerada por modelo de Inteligência Artificial e pode conter erros. O GeoVision.AI e seus desenvolvedores não se responsabilizam por danos decorrentes de decisões tomadas exclusivamente com base na classificação automática, sem confirmação por vistoria oficial. Em caso de risco iminente, o usuário deve sempre contatar diretamente a Defesa Civil (199) ou os serviços de emergência (193).',
  },
  {
    titulo: '6. Uso adequado',
    texto:
      'É proibido enviar imagens falsas, de outras localidades, ou utilizar o sistema para fins diferentes do reporte de riscos estruturais reais.',
  },
  {
    titulo: '7. Propriedade intelectual',
    texto:
      'O sistema, sua marca, design e modelo de IA são de autoria do projeto GeoVision.AI (Programa JCC 2026) e não podem ser reproduzidos sem autorização.',
  },
  {
    titulo: '8. Alterações',
    texto:
      'Estes termos podem ser atualizados; alterações relevantes serão comunicadas por e-mail ou aviso no aplicativo.',
  },
  {
    titulo: '9. Contato',
    texto:
      'Dúvidas, solicitações de dados ou denúncias de uso indevido: estherquarterollii@gmail.com',
  },
]

export function TermosDeUso() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-1 text-2xl">Termos de Uso e Política de Privacidade</h1>
      <p className="text-tinta-suave mb-2 text-sm">GeoVision.AI</p>
      <div className="bg-risco-medio-suave text-tinta rounded-cidadao mb-8 p-3 text-sm">
        Rascunho para revisão jurídica — este texto ainda não passou por
        validação legal formal.
      </div>

      <div className="flex flex-col gap-6">
        {ARTIGOS.map((artigo) => (
          <section key={artigo.titulo}>
            <h2 className="mb-1.5 text-base font-semibold">{artigo.titulo}</h2>
            <p className="text-tinta-suave text-sm leading-relaxed">{artigo.texto}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
