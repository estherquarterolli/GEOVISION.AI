import io
import json
from pathlib import Path
import sys
import unittest
import csv
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai-service/app/services"))
from contrato_modelo import codificar_triagem, preparar_imagem, metadados_modelo, CLASSES, VOCABULARIO
from calculos_observacionais import abertura_mm, evolucao_mm_dia, desaprumo_mm_m, distorcao_angular, gut_tecnico
from treinar_colab import dividir, treinar, ler_manifesto
from preparar_manifesto import preparar_manifesto, conferir_manifesto


class CalculosTest(unittest.TestCase):
    def test_unidades(self):
        self.assertAlmostEqual(abertura_mm(4, 200, 10, mesmo_plano=True), .2)
        self.assertAlmostEqual(evolucao_mm_dia(.4, .7, 48), .15)
        self.assertEqual(desaprumo_mm_m(6, 3), 2)
        self.assertEqual(distorcao_angular(5, 5), .001)

    def test_recusa_geometria_desconhecida_e_denominadores(self):
        for executar in [lambda: abertura_mm(4, 200, 10), lambda: evolucao_mm_dia(1, 2, 0),
                         lambda: desaprumo_mm_m(6, -1), lambda: distorcao_angular(5, 0),
                         lambda: evolucao_mm_dia(1, float('nan'), 24)]:
            with self.assertRaises(ValueError):
                executar()

    def test_gut_sem_inventar_dados(self):
        self.assertIsNone(gut_tecnico(10, None, 8)["pontuacao"])
        self.assertEqual(gut_tecnico(10, 8, 6)["pontuacao"], 480)
        with self.assertRaises(ValueError):
            gut_tecnico(10, 5, 8)


class ContratoTest(unittest.TestCase):
    def test_zero_diferente_de_ausencia(self):
        ausente = codificar_triagem({})
        zero = codificar_triagem({"abertura_mm": 0})
        self.assertFalse(np.array_equal(ausente, zero))
        self.assertEqual(len(ausente), sum(map(len, VOCABULARIO.values())) + 8)
        self.assertEqual(zero[-7], 1)

    def test_recusa_medidas_invalidas(self):
        for valor in [-1, 'NaN', 'inf', True]:
            with self.assertRaises(ValueError):
                codificar_triagem({"abertura_mm": valor})
        self.assertEqual(codificar_triagem({"evolucao_mm_dia": -.1})[-6], np.float32(-.1))

    def test_geometria_imagem_e_pixels(self):
        arquivo = io.BytesIO()
        Image.new('RGB', (100, 50), (255, 0, 0)).save(arquivo, format='PNG')
        imagem = preparar_imagem(arquivo.getvalue())
        self.assertEqual(imagem.shape, (600, 660, 3))
        np.testing.assert_array_equal(imagem[0, 0], [127, 127, 127])
        np.testing.assert_array_equal(imagem[300, 330], [255, 0, 0])

    def test_metadados(self):
        meta = metadados_modelo('multimodal')
        self.assertEqual(meta['schema_version'], 2)
        self.assertFalse(meta['homologado'])
        self.assertEqual(meta['classes'], CLASSES)


class DadosTest(unittest.TestCase):
    def test_pastas_antigas_geram_csv_exploratorio(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            pasta = raiz / '01_imagens_brutas/baixo'
            pasta.mkdir(parents=True)
            Image.new('RGB', (8, 8), 'red').save(pasta / 'a.jpg')
            arquivo = conferir_manifesto(raiz, exploratoria=True)
            self.assertEqual(arquivo.name, 'imagens.csv')
            linhas, _ = ler_manifesto(raiz, 'visual', avaliacao_exploratoria=True)
            self.assertEqual(len(linhas), 1)
            self.assertEqual(linhas[0]['edificio_id'], '')
            with self.assertRaises(ValueError):
                ler_manifesto(raiz, 'visual')
            antes = arquivo.read_bytes()
            self.assertEqual(preparar_manifesto(raiz), arquivo)
            self.assertEqual(antes, arquivo.read_bytes())

    def test_recupera_dataset_limpo_e_deduplica(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            for split in ('train', 'val'):
                pasta = raiz / '02_dataset_limpo' / split / 'medio'
                pasta.mkdir(parents=True)
                Image.new('RGB', (8, 8), 'blue').save(pasta / 'copia.png')
            preparar_manifesto(raiz, exploratoria=True)
            linhas, _ = ler_manifesto(raiz, 'visual', avaliacao_exploratoria=True)
            self.assertEqual(len(linhas), 1)
            self.assertTrue((raiz / '02_dataset_limpo/val/medio/copia.png').exists())

    def test_imagem_com_rotulos_conflitantes(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            for classe in ('baixo', 'critico'):
                pasta = raiz / '01_imagens_brutas' / classe
                pasta.mkdir(parents=True)
                Image.new('RGB', (8, 8), 'red').save(pasta / 'mesma.png')
            preparar_manifesto(raiz, exploratoria=True)
            with self.assertRaisesRegex(ValueError, 'rótulos diferentes'):
                ler_manifesto(raiz, 'visual', avaliacao_exploratoria=True)

    def test_prefere_brutas_sem_misturar_copias_limpas(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            for relativa in ('01_imagens_brutas/baixo', '02_dataset_limpo/train/medio'):
                pasta = raiz / relativa
                pasta.mkdir(parents=True)
                Image.new('RGB', (8, 8), 'red').save(pasta / 'foto.png')
            preparar_manifesto(raiz, exploratoria=True)
            linhas, _ = ler_manifesto(raiz, 'visual', avaliacao_exploratoria=True)
            self.assertEqual([r['rotulo'] for r in linhas], ['baixo'])

    def test_csv_ausente_e_rascunho_sem_id_inventado(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            with self.assertRaisesRegex(ValueError, 'Arquivo não encontrado'):
                ler_manifesto(raiz, 'visual')
            pasta = raiz / '01_imagens_brutas/baixo'
            pasta.mkdir(parents=True)
            Image.new('RGB', (8, 8), 'red').save(pasta / 'foto.png')
            arquivo = preparar_manifesto(raiz)
            self.assertEqual(arquivo.name, 'imagens.preencher.csv')
            with arquivo.open(encoding='utf-8-sig', newline='') as f:
                self.assertEqual(next(csv.DictReader(f))['edificio_id'], '')
            with self.assertRaisesRegex(ValueError, 'Preencha edificio_id'):
                conferir_manifesto(raiz)

    def test_split_exploratorio_sem_edificios_ficticios(self):
        linhas = [{'edificio_id': '', '_grupo_split': f'{c}_{i}', 'rotulo': c}
                  for c in CLASSES for i in range(10)]
        y, treino, val, teste = dividir(linhas)
        self.assertEqual(len(treino) + len(val) + len(teste), 40)
        self.assertFalse(set(treino) & set(val) or set(treino) & set(teste) or set(val) & set(teste))
        self.assertTrue(all(r['edificio_id'] == '' for r in linhas))

    def test_edificios_isolados(self):
        linhas = [{"edificio_id": f"{classe}_{i}", "rotulo": classe}
                  for classe in CLASSES for i in range(10) for foto in range(3)]
        y, treino, val, teste = dividir(linhas)
        grupos = [set(linhas[i]['edificio_id'] for i in indices) for indices in (treino, val, teste)]
        self.assertFalse(grupos[0] & grupos[1] or grupos[0] & grupos[2] or grupos[1] & grupos[2])
        self.assertEqual(len(treino) + len(val) + len(teste), len(y))
        for indices in (treino, val, teste):
            self.assertEqual(set(y[indices]), {0, 1, 2, 3})

    def test_orcamento_invalido_antes_de_gpu(self):
        for horas in [0, 4, float('nan')]:
            with self.assertRaises(ValueError):
                treinar('inexistente', horas=horas)

    def test_notebook_contem_fontes_atuais(self):
        pasta = Path(__file__).resolve().parent
        notebook = json.loads((pasta / 'GeoVision_660x600.ipynb').read_text(encoding='utf-8'))
        contexto = {}
        # Só a atribuição de fontes; nenhuma célula Colab ou treino é executada.
        import ast
        arvore = ast.parse(''.join(notebook['cells'][2]['source']))
        fontes = next(ast.literal_eval(n.value) for n in arvore.body if isinstance(n, ast.Assign))
        self.assertEqual(fontes['treinar_colab.py'], (pasta / 'treinar_colab.py').read_text(encoding='utf-8'))
        self.assertEqual(fontes['contrato_modelo.py'], (pasta.parent / 'ai-service/app/services/contrato_modelo.py').read_text(encoding='utf-8'))
        self.assertEqual(fontes['preparar_manifesto.py'], (pasta / 'preparar_manifesto.py').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
