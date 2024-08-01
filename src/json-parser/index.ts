import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface MatMatrix {
    id: string,
    color: THREE.Color | THREE.Texture,
    metalness: THREE.Texture | number,
    roughness: THREE.Texture | number,
    transparent: boolean,
    opacity: number,
    transmission: number
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
        this.mergedMat = new THREE.MeshPhysicalMaterial
        this.finalMesh = null
        this.convertedGroup = new THREE.Group

        this.parseModel()
    }

    url: string;
    group: THREE.Group | null;

    allMaterials: THREE.MeshPhysicalMaterial[];
    matMatrixes: MatMatrix[];
    canvas2D: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null
    parsedBufferGeos: BufferGeos[] = []
    bufferGeos: THREE.BufferGeometry[] = []
    mergedGeo: THREE.BufferGeometry | null
    mergedMat: THREE.MeshPhysicalMaterial
    diffuseMap: THREE.CanvasTexture | THREE.Texture | null
    alphaMap: THREE.CanvasTexture | THREE.Texture | null
    metalnessMap: THREE.CanvasTexture | THREE.Texture | null
    roughnessMap: THREE.CanvasTexture | THREE.Texture | null
    scene: THREE.Scene
    textureSize: number

    debugModel: boolean;
    debugTextures: boolean;

    convertedGroup: THREE.Group

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

                // materials.forEach((item: THREE.MeshPhysicalMaterial) => {
                // })

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

        const meshes: THREE.Mesh[] = []

        bufferGeos.forEach((item: BufferGeos, key) => {
            const mesh = this.createMatrixForEachMesh(item, key)


            const texturesContainer = document.getElementById('texturesContainer')

            const el = document.createElement("a");

            const img = document.createElement("img");
            img.src = mesh.material.map?.image.toDataURL("image/png").replace("image/png", "image/octet-stream");
            img.classList.add('texture')
            el.setAttribute('download', "diffuse-map.png")
            el.setAttribute('href', "/diffuse-map.png")
            el.appendChild(img)
            texturesContainer?.appendChild(el)
            meshes.push(mesh)
        })

        const group = new THREE.Group()

        meshes.forEach(mesh => {
            group.add(mesh.clone())
            this.scene.add(mesh.clone())
        })

        this.convertedGroup = group;
    }

    exportConvertedGroup() {
        if (this.convertedGroup) {
            this.exportGroup(this.convertedGroup)
        }
    }


    exportOriginalGroup() {
        if (this.group) {
            this.exportGroup(this.group)
        }
    }


    combineAllMaterialsIntoOne() {
        if (!this.allMaterials.length) return
        if (this.allMaterials.length === 0) return
        this.createMatrix(Math.ceil(Math.sqrt(this.allMaterials.length)))
    }

    createMatrixForEachMesh(item: BufferGeos, key: number) {

        const matMatrixes = []
        const geos = []
        const geometry = item.geo
        const num = Math.ceil(Math.sqrt(item.matsAssigned.length))


        for (let i = 0; i < num * num; i++) {

            const matIndex = item.matsAssigned[i]

            if (!this.allMaterials[i]) {
                matMatrixes.push(null)
                geos.push(null)
                break
            }
            const filteredMat = this.allMaterials.find(item => item.uuid === matIndex)

            if (!filteredMat) {
                matMatrixes.push(null)
                geos.push(null)
                break
            }
            const id = filteredMat.uuid
            geos.push(geometry.clone())

            const color = filteredMat.map ? filteredMat.map : filteredMat.color
            const metalness = filteredMat.metalnessMap ? filteredMat.metalnessMap : filteredMat.metalness
            const roughness = filteredMat.roughnessMap ? filteredMat.roughnessMap : filteredMat.roughness
            matMatrixes.push({
                id: id,
                color: color,
                metalness: metalness,
                roughness: roughness,
                transparent: filteredMat.transparent,
                opacity: filteredMat.opacity,
                transmission: filteredMat.transmission
            })
        }

        // RETURNS
        // matMatrixes
        // geos

        const mergedGeo = geometry
        const mergedMat = this.createImageDataOfGeos(matMatrixes, key)

        const mesh = new THREE.Mesh(mergedGeo, mergedMat)
        return mesh
    }


    moveUvsOfGeos(geosList: (THREE.BufferGeometry | null)[]) {

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

            const centerVec = new THREE.Vector2(centerX, centerY);

            for (let i = 0; i < count; i++) {
                const u = uvAttribute.getX(i) / multiple + offsetX;
                const v = uvAttribute.getY(i) / multiple + offsetY;
                uvAttribute.setXY(i, u, v);
            }
            return geo
        })

        const geos = geosList.filter(item => item) as THREE.BufferGeometry[]
        const mergedGeo = mergeBufferGeometries(geos);
        return mergedGeo
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
        canvas.width = size;
        canvas.height = size;

        this.canvas2D = canvas
        this.ctx = this.canvas2D.getContext("2d");


        this.diffuseMap = this.createDiffuseMap(multiple, this.canvas2D);
        this.alphaMap = this.createAlphaMap(multiple, this.canvas2D);


        if (this.debugTextures) {
            const image = this.canvas2D.toDataURL("image/png").replace("image/png", "image/octet-stream");
            window.location.href = image;
        }

        this.createMergedMat()
        this.createMesh()
    }


    createImageDataOfGeos(materialsMatrices: (MatMatrix | null)[], key: number) {

        const count = materialsMatrices.length
        const multiple = Math.sqrt(count)
        const size = this.textureSize

        const canvas = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas2.width = size;
        canvas2.height = size;

        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
        const ctx2 = canvas2.getContext("2d") as CanvasRenderingContext2D;

        const diffuseMap = this.createDiffuseMapFromMatrices(multiple, canvas, materialsMatrices, ctx);

        const transmitionMap = this.createTransmitionMapFromMatrices(multiple, canvas2, materialsMatrices, ctx2)

        this.amendAlpha(ctx, ctx2)

        const mergedMaterial = new THREE.MeshPhysicalMaterial();

        const firstMat = materialsMatrices[0]
        if (!firstMat) return

        
        const isTransparent = materialsMatrices.some(item => item?.transmission && item.transmission > 0)

        mergedMaterial.map = diffuseMap;
        mergedMaterial.alphaMap = transmitionMap;
        mergedMaterial.transparent = isTransparent;
        mergedMaterial.depthTest = true;
        mergedMaterial.depthWrite = true;
        mergedMaterial.side = THREE.DoubleSide;
        mergedMaterial.ior = 7 / 3;
        mergedMaterial.roughness = firstMat.roughness as number;
        mergedMaterial.metalness = firstMat.metalness as number;

        return mergedMaterial

    }

    amendAlpha(ctx: CanvasRenderingContext2D, ctx2: CanvasRenderingContext2D) {

        const diffuseMap = ctx.getImageData(
            0,
            0,
            this.textureSize,
            this.textureSize
        );

        const alphaMap = ctx2.getImageData(
            0,
            0,
            this.textureSize,
            this.textureSize
        );

        for (var i = 0; i < diffuseMap.data.length; i += 4) {
            diffuseMap.data[i + 3] = alphaMap.data[i + 3]
        }

        ctx.putImageData(
            diffuseMap,
            0,
            0
        )
    }


    createDiffuseMapFromMatrices(multiple: number, canvas2D: HTMLCanvasElement, matMatrixes: (MatMatrix | null)[], ctx: CanvasRenderingContext2D) {

        matMatrixes.forEach((mat) => {

            const mapping = [
                0,
                0,
                this.textureSize,
                this.textureSize,
            ];

            if (!mat) return

            if (mat.color instanceof THREE.Texture) {
                this.assignTextureToSpecifiedCtx(mat.color, mapping, multiple, ctx)
            }

            if (mat.color instanceof THREE.Color) {
                this.assignColorAlphaToSpecifiedCtx(mat.color, mat.transparent ? mat.opacity : 1, mapping, ctx)
            }
        })

        return new THREE.CanvasTexture(canvas2D);
    }

    createTransmitionMapFromMatrices(multiple: number, canvas2D: HTMLCanvasElement, matMatrixes: (MatMatrix | null)[], ctx: CanvasRenderingContext2D) {

        matMatrixes.forEach((mat) => {

            const mapping = [
                0,
                0,
                this.textureSize,
                this.textureSize,
            ];

            if (!mat) return

            if (mat.color instanceof THREE.Texture) {
                this.assignAlphaTextureToSpecifiedCtx(mat.color, mapping, 1, ctx)
            }

            if (mat.color instanceof THREE.Color) {
                this.assignColorAlphaToSpecifiedCtx(
                    new THREE.Color(
                        1 - mat.transmission + 0.4,
                        1 - mat.transmission + 0.4,
                        1 - mat.transmission + 0.4
                    ),
                    1 - mat.transmission + 0.4,
                    mapping,
                    ctx
                )
            }
        })

        return new THREE.CanvasTexture(canvas2D);
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

    assignTextureToSpecifiedCtx(texture: THREE.Texture, mapping: number[], multiple: number, ctx: CanvasRenderingContext2D) {
        ctx.drawImage(
            texture.source.data,
            mapping[0] - texture.offset.x * this.textureSize,
            mapping[1] - texture.offset.y * this.textureSize,
            mapping[2] * 1 / texture.repeat.x,
            mapping[3] * 1 / texture.repeat.y,
        )
    }

    assignAlphaTextureToSpecifiedCtx(texture: THREE.Texture, mapping: number[], multiple: number, ctx: CanvasRenderingContext2D) {

        const canvas = document.createElement('canvas');
        canvas.width = this.textureSize;
        canvas.height = this.textureSize;

        const ctx2 = canvas.getContext("2d");

        if (!ctx2) return

        ctx2.drawImage(
            texture.source.data,
            mapping[0] - texture.offset.x * this.textureSize,
            mapping[1] - texture.offset.y * this.textureSize,
            mapping[2] * 1 / texture.repeat.x,
            mapping[3] * 1 / texture.repeat.y,
        )

        const myImage = ctx2.getImageData(
            0,
            0,
            this.textureSize,
            this.textureSize
        );


        for (var i = 0; i < myImage.data.length; i += 4) {
            // Get unitary value of the pixel
            const r = myImage.data[i] / 255;
            const g = myImage.data[i + 1] / 255;
            const b = myImage.data[i + 2] / 255;
            myImage.data[i + 0] *= 255;
            myImage.data[i + 1] *= 255;
            myImage.data[i + 2] *= 255;
        }


        ctx2.putImageData(
            myImage,
            0,
            0
        )

        ctx.drawImage(canvas, 0, 0, this.textureSize, this.textureSize)
    }

    assignTextureToSpecifiedCtxTransmittion(texture: THREE.Texture, mapping: number[], multiple: number, ctx: CanvasRenderingContext2D) {
        ctx.drawImage(
            texture.source.data,
            mapping[0] - texture.offset.x * this.textureSize,
            mapping[1] - texture.offset.y * this.textureSize,
            mapping[2] * 1 / texture.repeat.x,
            mapping[3] * 1 / texture.repeat.y,
        )
    }

    assignColorAlphaToSpecifiedCtx(color: THREE.Color, aplha: number, mapping: number[], ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = `rgba(
        ${color.r * 255},
        ${color.g * 255},
        ${color.b * 255},
        ${aplha}
        )`;

        ctx.fillRect(
            mapping[0],
            mapping[1],
            mapping[2],
            mapping[3]
        );
    }


    assignColorAlphaToSpecifiedCtxTransmittion(color: THREE.Color, aplha: number, mapping: number[], ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = `rgba(
        ${color.r * 255},
        ${color.g * 255},
        ${color.b * 255},
        ${aplha}
        )`;

        ctx.fillRect(
            mapping[0],
            mapping[1],
            mapping[2],
            mapping[3]
        );
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

        // this.scene.add(mesh)

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

    exportGroup(group: THREE.Group) {
        const exporter = new GLTFExporter();

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
            group,
            function (gltf) {
                saveArrayBuffer(gltf as ArrayBuffer, 'scene.gltf');
            },

            function (error) {
                console.log(error);
            }, {
            binary: true
        }
        );
    }
}