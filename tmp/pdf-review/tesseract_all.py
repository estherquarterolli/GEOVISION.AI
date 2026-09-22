from pathlib import Path
import pymupdf,subprocess,os,time
from concurrent.futures import ThreadPoolExecutor
root=Path('C:/Users/esther.santos/Downloads'); out=Path('tmp/pdf-review')
tess='C:/Users/esther.santos/AppData/Local/Programs/Tesseract-OCR/tesseract.exe'
os.environ['OMP_THREAD_LIMIT']='1'
def run(job):
 n,p,i=job
 folder=out/f'tess{n}'; folder.mkdir(exist_ok=True)
 target=folder/f'{i+1:04}'
 if target.with_suffix('.txt').exists(): return
 d=pymupdf.open(p); page=d[i]
 pix=page.get_pixmap(matrix=pymupdf.Matrix(2,2),alpha=False)
 img=target.with_suffix('.png'); pix.save(img)
 subprocess.run([tess,str(img),str(target),'-l','por','--psm','3'],capture_output=True,check=True)
 # Preserva render intermediario para revisao visual
 return n,i+1
jobs=[]
for n,pattern in [(2,'417620118*'),(3,'686421887*')]:
 p=next(root.glob(pattern)); d=pymupdf.open(p)
 jobs.extend((n,p,i) for i in range(len(d)))
with ThreadPoolExecutor(max_workers=3) as pool:
 for k,result in enumerate(pool.map(run,jobs)):
  if k%15==0: print(k+1,len(jobs),result,flush=True)
print('OCR CONCLUIDO',flush=True)

