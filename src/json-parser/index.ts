import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface MatMatrix {
    id: string,
    color: THREE.Color | THREE.Texture,
    metalness: THREE.Texture | number,
    roughness: THREE.Texture | number,
    transparent: boolean,
    opacity: number
}

interface BufferGeos {
    geo: THREE.BufferGeometry
    matsAssigned: string[]
}


export class ObjParser {
    constructor(url: string, scene: THREE.Scene) {
        // props
        this.url = url;
        this.scene = scene;

        // parsed models and materials
        this.group = null
        this.allMaterials = []
        this.matMatrixes = []
        this.parsedBufferGeos = []
        this.bufferGeos = []

        // maps
        this.ctx = null
        this.canvas2D = null
        this.diffuseMap = null
        this.alphaMap = null
        this.roughnessMap = null
        this.metalnessMap = null
        this.textureSize = 4096

        // debug
        this.debugModel = false
        this.debugTextures = false


        // final meshes
        this.mergedGeo = null
        this.mergedMat = new THREE.MeshStandardMaterial
        this.finalMesh = null

        this.parseModel()
    }

    url: string;
    group: THREE.Group | null;

    allMaterials: THREE.MeshStandardMaterial[];
    matMatrixes: MatMatrix[];
    canvas2D: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null
    parsedBufferGeos: BufferGeos[] = []
    bufferGeos: THREE.BufferGeometry[] = []
    mergedGeo: THREE.BufferGeometry | null
    mergedMat: THREE.MeshStandardMaterial
    diffuseMap: THREE.CanvasTexture | THREE.Texture | null
    alphaMap: THREE.CanvasTexture | THREE.Texture | null
    metalnessMap: THREE.CanvasTexture | THREE.Texture | null
    roughnessMap: THREE.CanvasTexture | THREE.Texture | null
    scene: THREE.Scene
    textureSize: number

    debugModel: boolean;
    debugTextures: boolean;

    finalMesh: THREE.Mesh | null


    parseModel(): void {
        const loader = new THREE.ObjectLoader();
        const load = async function modelLoader(url: string) {
            return new Promise((resolve, reject) => {
                loader.load(url, obj => {
                    if (obj instanceof THREE.Group) {
                        return resolve(obj)
                    }
                }, () => {

                }, reject);
            });
        }
        load(this.url).then((res) => {
            if (res instanceof THREE.Group) {
                this.group = res
                this.parseGeoMaterials()
            }
        })
    }

    parseGeoMaterials() {

        const bufferGeos: BufferGeos[] = []

        this.group?.traverse((child) => {
            if (child instanceof THREE.Mesh) {

                child.updateMatrix()

                const materials = child.material
                const matsAssigned = materials.map((item: THREE.MeshStandardMaterial) => item.uuid)
                const geo = child.geometry.clone() as THREE.BufferGeometry
                geo.clearGroups();

                geo.applyMatrix4(child.matrix)
                if (child.parent) {
                    geo.applyMatrix4(child.parent.matrix)
                }
                if (child.parent?.parent) {
                    geo.applyMatrix4(child.parent.parent.matrix)
                }

                // do

                bufferGeos.push({
                    geo: geo,
                    matsAssigned: matsAssigned
                });

                if (child.material.length) {
                    this.allMaterials.push(...child.material)
                }
                else {
                    this.allMaterials.push(child.material)
                }
            }
        })

        this.parsedBufferGeos = bufferGeos

        this.combineAllMaterialsIntoOne()
    }


    combineAllMaterialsIntoOne() {
        if (!this.allMaterials.length) return
        if (this.allMaterials.length === 0) return
        this.createMatrix(Math.ceil(Math.sqrt(this.allMaterials.length)))
    }

    createMatrix(num: number) {
        const matMatrixes = []
        const geos = []

        for (let i = 0; i < num * num; i++) {
            if (!this.allMaterials[i]) {
                matMatrixes.push(null)
                geos.push(null)
                break
            }
            const mat = this.allMaterials[i]
            const id = mat.uuid

            // retrieve geometry from material id
            const geo = this.parsedBufferGeos.find(item => item.matsAssigned.includes(id))

            if (geo && geo.geo) {
                geos.push(geo.geo.clone())
            }

            // assign material values into a new material
            const color = mat.map ? mat.map : mat.color
            const metalness = mat.metalnessMap ? mat.metalnessMap : mat.metalness
            const roughness = mat.roughnessMap ? mat.roughnessMap : mat.roughness
            matMatrixes.push({
                id: id,
                color: color,
                metalness: metalness,
                roughness: roughness,
                transparent: mat.transparent,
                opacity: mat.opacity
            })
        }

        // @ts-ignore
        this.matMatrixes = matMatrixes
        // @ts-ignore
        this.bufferGeos = geos

        this.createImageData()
        this.moveUvs()
    }

    createImageData() {
        if (!this.matMatrixes) return
        const count = this.matMatrixes.length
        const multiple = Math.sqrt(count)
        const size = this.textureSize

        const canvas = document.createElement('canvas');
        const canvasalpha = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        this.canvas2D = canvas
        this.ctx = this.canvas2D.getContext("2d");
        const ctx2 = canvasalpha.getContext("2d");

        const arr = [
            {
                id: 1,
                color: new THREE.Color('red')
            },
            {
                id: 1,
                color: new THREE.Color('yellow')
            },
            {
                id: 1,
                color: new THREE.Color('pink')
            },
            {
                id: 1,
                color: new THREE.Color('violet')
            },
            {
                id: 1,
                color: new THREE.Color('brown')
            },
            {
                id: 1,
                color: new THREE.Color('cyan')
            },
            {
                id: 1,
                color: new THREE.Color('orange')
            },
            {
                id: 1,
                color: new THREE.Color('yellow')
            },
            {
                id: 1,
                color: new THREE.Color('blue')
            },
        ]



        this.diffuseMap = this.createDiffuseMap(multiple, this.canvas2D);
        this.alphaMap = this.createAlphaMap(multiple, this.canvas2D);


        if (this.debugTextures) {
            const image = this.canvas2D.toDataURL("image/png").replace("image/png", "image/octet-stream");
            window.location.href = image;
        }

        this.createMergedMat()
        this.createMesh()
    }

    getMapping(index: number, multiple: number) {

        const flatArrayCoordinates = this.getFlatArrayCoordinates(Array.from(Array(multiple * multiple).keys()), multiple);
        flatArrayCoordinates[index]

        const offsetX = flatArrayCoordinates[index].x
        const offsetY = flatArrayCoordinates[index].y

        const x = offsetX / multiple * this.textureSize;
        const y = (-offsetY + multiple - 1) / multiple * this.textureSize;

        return [
            x,
            y,
            this.textureSize / multiple,
            this.textureSize / multiple
        ]
    }

    getTextureMapping(texture: THREE.Texture, index: number, multiple: number) {

        const flatArrayCoordinates = this.getFlatArrayCoordinates(Array.from(Array(multiple * multiple).keys()), multiple);
        flatArrayCoordinates[index]

        const offsetX = flatArrayCoordinates[index].x
        const offsetY = flatArrayCoordinates[index].y

        const x = offsetX / multiple * this.textureSize;
        const y = -offsetY / multiple * this.textureSize + 2 / multiple * this.textureSize;

        return [
            x,
            y,
            this.textureSize / multiple,
            this.textureSize / multiple
        ]
    }

    createDiffuseMap(multiple: number, canvas2D: HTMLCanvasElement) {
        this.matMatrixes.forEach((mat, index) => {

            if (!mat) return


            if (mat.color instanceof THREE.Texture) {
                const mapping = this.getMapping(index, multiple)
                this.assignTextureToCtx(mat.color, mapping, multiple)
            }

            if (mat.color instanceof THREE.Color) {
                const mapping = this.getMapping(index, multiple)
                this.assignColorAlphaToCtx(mat.color, mat.transparent ? mat.opacity : 1, mapping)
            }
        })

        return new THREE.CanvasTexture(canvas2D);
    }

    createAlphaMap(multiple: number, canvas2D: HTMLCanvasElement) {
        this.matMatrixes.forEach((mat, index) => {

            if (!mat) return

            const mapping = this.getMapping(index, multiple)

            if (mat.color instanceof THREE.Texture) {
                this.assignTextureToCtx(mat.color, mapping, multiple)
            }

            if (mat.color instanceof THREE.Color) {
                this.assignColorAlphaToCtx(mat.color, mat.transparent ? mat.opacity : 1, mapping)
            }
        })

        return new THREE.CanvasTexture(canvas2D);
    }
    createMetalnessMap(multiple: number, size: number, canvas2D: HTMLCanvasElement) {

    }
    createRoughnessMap(multiple: number, size: number, canvas2D: HTMLCanvasElement) {

    }

    assignTextureToCtx(texture: THREE.Texture, mapping: number[], multiple: number) {
        if (!this.ctx) return
        this.ctx.drawImage(
            texture.source.data,
            mapping[0] - texture.offset.x * this.textureSize / multiple,
            mapping[1] - texture.offset.y * this.textureSize / multiple,
            mapping[2] * 1 / texture.repeat.x,
            mapping[3] * 1 / texture.repeat.y,
        )
    }

    assignColorToCtx(color: THREE.Color, mapping: number[]) {
        if (!this.ctx) return

        this.ctx.fillStyle = `rgba(
        ${color.r * 255},
        ${color.g * 255},
        ${color.b * 255},
        255
        )`;

        this.ctx.fillRect(
            mapping[0],
            mapping[1],
            mapping[2],
            mapping[3]
        );
    }

    assignColorAlphaToCtx(color: THREE.Color, aplha: number, mapping: number[]) {
        if (!this.ctx) return

        this.ctx.fillStyle = `rgba(
        ${color.r * 255},
        ${color.g * 255},
        ${color.b * 255},
        ${aplha * 255}
        )`;

        this.ctx.fillRect(
            mapping[0],
            mapping[1],
            mapping[2],
            mapping[3]
        );
    }

    getFlatArrayCoordinates(arr: number[], size: number) {
        let coordinates = [];

        for (let index = 0; index < arr.length; index++) {

            const row = Math.floor(index / size);
            const column = index % size;

            coordinates.push({ x: column, y: row });
        }

        return coordinates;
    }

    restrainUv(e: number) {

        if (e < -1) {
            return e + Math.floor(e)
        }
        if (e > 1) {
            return e - Math.floor(e)
        }
        return e
    }

    moveUvs() {

        const geosList = this.bufferGeos
        const listCount = geosList.length
        const multiple = Math.sqrt(listCount)

        const flatArrayCoordinates = this.getFlatArrayCoordinates(Array.from(Array(multiple * multiple).keys()), multiple);

        geosList.forEach((geo, key) => {
            if (!geo) return

            const uvAttribute = geo.attributes.uv;
            const count = uvAttribute.count;

            const offsetX = flatArrayCoordinates[key].x / multiple;
            const offsetY = flatArrayCoordinates[key].y / multiple;

            const allX = []
            const allY = []

            for (let i = 0; i < count; i++) {
                const u = uvAttribute.getX(i);
                allX.push(u)
                const v = uvAttribute.getY(i);
                allY.push(v)
            }

            const minX = Math.min(...allX)
            const maxX = Math.max(...allX)
            const centerX = (maxX - minX) / 2

            const minY = Math.min(...allY)
            const maxY = Math.max(...allY)
            const centerY = (maxY - minY) / 2

            for (let i = 0; i < count; i++) {
                const u = uvAttribute.getX(i) / multiple + offsetX;
                const v = uvAttribute.getY(i) / multiple + offsetY;
                uvAttribute.setXY(i, u, v);
            }
            return geo
        })

        this.mergeGeos()
    }

    mergeGeos() {
        const geos = this.bufferGeos.filter(item => item)
        const mergedGeo = mergeBufferGeometries(geos);
        this.mergedGeo = mergedGeo
        this.createMesh()
    }

    createMergedMat() {
        this.mergedMat.map = this.diffuseMap as unknown as THREE.Texture
        this.mergedMat.transparent = true
        this.mergedMat.depthTest = true
        this.mergedMat.depthWrite = true
        this.mergedMat.alphaTest = 0.5
        this.mergedMat.blendSrcAlpha = 1
        this.mergedMat.side = THREE.FrontSide
        this.createMesh()
    }

    createMesh() {

        if (!this.mergedGeo) return
        if (!this.mergedMat) return

        const mesh = new THREE.Mesh(this.mergedGeo, this.mergedMat);

        mesh.scale.set(0.02, 0.02, 0.02)
        this.finalMesh = mesh

        this.scene.add(mesh)

        this.exportModel(this.finalMesh)
    }

    returnFinalMesh() {
        if (!this.mergedMat.map) return
        return this.finalMesh
    }

    returnMainModel() {
        return this.group
    }

    exportModel(mesh: THREE.Mesh) {
        const exporter = new GLTFExporter();
        // if (!this.finalMesh) return

        function saveArrayBuffer(buffer: ArrayBuffer, filename: string) {
            save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
        }

        const link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link);

        function save(blob: Blob, filename: string) {
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }

        exporter.parse(
            mesh,
            function (gltf) {
                saveArrayBuffer(gltf as ArrayBuffer, 'scene.glb');
            },

            function (error) {
                console.log(error);
            }, {
            binary: true
        }
        );
    }
}