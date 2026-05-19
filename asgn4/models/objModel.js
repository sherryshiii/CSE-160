// Simple OBJ loader. Supports v, vn and f lines.
class ObjModel extends Model {
    constructor(color) {
        super(color);
        this.loaded = false;
    }

    parse(text) {
        let positions = [];
        let normals   = [];
        let faces     = [];

        let lines = text.split(/\r?\n/);
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith("#")) continue;
            let parts = line.split(/\s+/);
            let cmd = parts[0];
            if (cmd === "v") {
                positions.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
            } else if (cmd === "vn") {
                normals.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
            } else if (cmd === "f") {
                let faceVerts = [];
                for (let i = 1; i < parts.length; i++) {
                    let sub = parts[i].split("/");
                    let pi = parseInt(sub[0], 10) - 1;
                    let ni = sub.length >= 3 && sub[2] !== "" ? parseInt(sub[2], 10) - 1 : -1;
                    faceVerts.push({pi: pi, ni: ni});
                }
                // fan triangulation
                for (let i = 1; i < faceVerts.length - 1; i++) {
                    faces.push([faceVerts[0], faceVerts[i], faceVerts[i + 1]]);
                }
            }
        }

        // if no normals in file, compute smooth normals
        let computeNormals = normals.length === 0;
        let computed = null;
        if (computeNormals) {
            computed = new Array(positions.length).fill(null).map(() => [0, 0, 0]);
            for (let face of faces) {
                let p0 = positions[face[0].pi];
                let p1 = positions[face[1].pi];
                let p2 = positions[face[2].pi];
                let e1 = [p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]];
                let e2 = [p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]];
                let nx = e1[1]*e2[2] - e1[2]*e2[1];
                let ny = e1[2]*e2[0] - e1[0]*e2[2];
                let nz = e1[0]*e2[1] - e1[1]*e2[0];
                for (let v of face) {
                    computed[v.pi][0] += nx;
                    computed[v.pi][1] += ny;
                    computed[v.pi][2] += nz;
                }
            }
            for (let n of computed) {
                let len = Math.hypot(n[0], n[1], n[2]) || 1;
                n[0] /= len; n[1] /= len; n[2] /= len;
            }
        }

        // flatten
        let finalVerts = [];
        let finalNorms = [];
        let finalIdx   = [];
        let idx = 0;
        for (let face of faces) {
            for (let v of face) {
                let p = positions[v.pi];
                finalVerts.push(p[0], p[1], p[2]);
                let n;
                if (v.ni >= 0 && v.ni < normals.length) {
                    n = normals[v.ni];
                } else if (computeNormals) {
                    n = computed[v.pi];
                } else {
                    n = [0, 1, 0];
                }
                finalNorms.push(n[0], n[1], n[2]);
                finalIdx.push(idx++);
            }
        }

        this.vertices = new Float32Array(finalVerts);
        this.normals  = new Float32Array(finalNorms);
        this.indices  = new Uint16Array(finalIdx);
        this.loaded   = true;
    }

    load(url) {
        return fetch(url)
            .then(r => r.text())
            .then(text => { this.parse(text); return this; });
    }
}
