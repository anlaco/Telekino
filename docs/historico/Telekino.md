**Telekino**  
*LabVIEW open source construido sobre Red-Lang. Si sabes programar en LabVIEW, sabes programar en Telekino.*  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsSeYxZy/lHd7GMACBrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA7GTBde8bLBeAAAAAElFTkSuQmCC)  
**La idea central**  
Telekino es un entorno de programación visual donde el programador trabaja exactamente igual que en LabVIEW: arrastrando bloques, conectándolos con wires y viendo los resultados en un panel de control. La diferencia es lo que ocurre por debajo.  
**Cada bloque es código Red. El diagrama compila a Red puro.**  
No hay un motor de ejecución intermedio, no hay un intérprete propietario. El diagrama que dibuja el usuario es una representación visual de un programa Red real. Al compilar, Telekino genera un fichero .red limpio, legible y ejecutable sin Telekino instalado.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANElEQVR4nO3OUQmAABBAsSdYxKYXx1gmEBOIFfwTYUuwZWa2ag8AgL841uquzq8nAAC8dj05WgYLQTzjnAAAAABJRU5ErkJggg==)  
**Dos vistas, un programa**  
Como en LabVIEW, Telekino tiene dos vistas que son dos caras del mismo programa:  
**Front Panel**  
La interfaz de usuario. El operador del programa la ve y la usa. Contiene:  
- Controles de entrada: valores numéricos, botones, sliders, selectores  
- Indicadores de salida: displays numéricos, LEDs, gráficas, textos  
- Decoración: etiquetas, marcos, separadores  
El Front Panel en Telekino es código Red/View. Cada control es un widget View con un binding reactivo al valor del nodo correspondiente en el diagrama.  
**Block Diagram**  
El programa. El desarrollador lo construye. Contiene:  
- Bloques: cada uno encapsula una función Red  
- Wires: transportan valores entre bloques, tipados  
- Estructuras de control: bucles, condicionales (como en LabVIEW)  
- Terminales: los puntos donde el Front Panel conecta con el diagrama  
El Block Diagram es la representación visual del código Red. No es una abstracción encima de Red — es Red, dibujado.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsScYxpg/h5VMYARvRrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA224BcUMk6pDAAAAAElFTkSuQmCC)  
**Principio de compilación**  
Cada bloque tiene asociado un fragmento de código Red. Cuando el usuario conecta bloques y pulsa compilar, Telekino:  
1. Recorre el grafo del diagrama en orden topológico  
2. Para cada nodo, instancia su plantilla de código Red con los valores de sus entradas  
3. Ensambla el resultado en un fichero .red ejecutable  
Ejemplo: un diagrama con dos constantes conectadas a un bloque suma genera exactamente esto:  
Red [title: "mi-diagrama"]  
   
 a: 5.0  
 b: 3.0  
 result: a + b  
   
 print result  
   
El código generado es idiomático. Un programador Red puede leerlo, modificarlo y ejecutarlo directamente.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAM0lEQVR4nO3OMQ0AIAwAwZKQ6kBqjSAOJywYYCIkd9OP36pqRMQMAAB+sfqJfLoBAMCN3NYoAzBA+QG0AAAAAElFTkSuQmCC)  
**Formato de fichero **.telekino  
Los diagramas se guardan en texto plano con sintaxis Red nativa. Un fichero .telekino es un bloque Red válido:  
telekino-diagram [  
     version: 1  
     nodes: [  
         node [id: 1  type: 'const   x: 40   y: 80   value: 5.0  label: "A"]  
         node [id: 2  type: 'const   x: 40   y: 160  value: 3.0  label: "B"]  
         node [id: 3  type: 'add     x: 200  y: 120  label: "Suma"]  
         node [id: 4  type: 'display x: 360  y: 120  label: "Resultado"]  
     ]  
     wires: [  
         wire [from: 1  port: 'out  to: 3  port: 'a]  
         wire [from: 2  port: 'out  to: 3  port: 'b]  
         wire [from: 3  port: 'out  to: 4  port: 'in]  
     ]  
 ]  
   
Cargar un diagrama es load %mi-diagrama.telekino. No hay parser que mantener.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsScYxpg/i2XMYARvRrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA22YBcnkstSpAAAAAElFTkSuQmCC)  
**Bloques primitivos**  
| | | |  
|-|-|-|  
| **Bloque** | **Tipo** | **Código Red generado** |   
| Constante | entrada | nombre: valor |   
| Suma | operación | resultado: a + b |   
| Resta | operación | resultado: a - b |   
| Multiplicación | operación | resultado: a * b |   
| Display | salida | print valor |   
   
**Funcionalidades**  
- Canvas interactivo con bloques arrastrables (drag & drop)  
- Conexión de bloques mediante wires dibujados a mano  
- Hit testing sobre bloques, puertos y wires  
- Renombrado de nodos con doble clic  
- Borrado de nodos y wires con Delete  
**Futuro**  
- Bucles y estructuras de control  
- Bloques de string y booleanos  
- Bloques de I/O (ficheros, puertos serie, red)  
- Editor de tipos de wire  
- Subdiagramas y VIs reutilizables  
- Depurador con sondas en los wires  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANUlEQVR4nO3OMQ2AABAAsSNhwgJGkPcrHpnRgQU2QtIq6DIze3UGAMBf3Gu1VcfXEwAAXrseaJkELjbMzy0AAAAASUVORK5CYII=)  
**Stack tecnológico**  
| | |  
|-|-|  
| **Capa** | **Tecnología** |   
| Lenguaje | Red-Lang (100%) |   
| UI del diagrama | Red/View + Draw dialect |   
| UI del panel | Red/View |   
| Compilador | Red puro (manipulación de bloques) |   
| Formato de fichero | Sintaxis Red nativa |   
| Plataforma | Windows, Linux, macOS (Red multiplataforma) |   
   
Sin dependencias externas. Un solo binario.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsSfYxZo/jVEMYQLPJrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA4rLBc059ysnAAAAAElFTkSuQmCC)  
**Por qué Red-Lang**  
Red tiene propiedades únicas que lo hacen ideal para este proyecto:  
**Homoiconicidad.** El código y los datos tienen la misma representación. Un diagrama Telekino y el programa Red que genera son estructuralmente el mismo objeto — uno visual, uno textual.  
**Dialectos.** Red permite crear DSLs dentro del lenguaje. El formato .telekino y el compilador son dialectos Red, no lenguajes nuevos.  
**Red/View.** Sistema de UI nativo, multiplataforma, incluido en el runtime de Red. Sin dependencias de terceros para la interfaz.  
**Tamaño.** El runtime de Red es un ejecutable de menos de 1 MB. Telekino distribuye sin instalador, sin JVM, sin Electron.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANElEQVR4nO3OUQmAABBAsSdYxKbXxlpGEAOIFfwTYUuwZWa2ag8AgL841uquzq8nAAC8dj05VAYO3phhoQAAAABJRU5ErkJggg==)  
**Filosofía del proyecto**  
Telekino no intenta ser compatible con LabVIEW. Intenta ser **familiar para quien ya sabe LabVIEW**.  
El modelo mental es idéntico: bloques, wires, Front Panel, Block Diagram, Run. El resultado es diferente: código abierto, sin licencias, compilando a un lenguaje real, en un binario que cabe en un USB.  
El objetivo a largo plazo es que un ingeniero que ha pasado años en LabVIEW pueda abrir Telekino y sentirse en casa — y que además pueda abrir el código generado, entenderlo y modificarlo a mano.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAM0lEQVR4nO3OQQmAUBBAwSeILbyYdDP8jAaxgjcRZhLMNjNntQIA4C/uvTqq6+sJAADvPS2NA0FrXqf/AAAAAElFTkSuQmCC)  
**Nombre**  
**Telekino** es el nombre del proyecto y de la aplicación. El nombre biene de Torres Quevedo.  
