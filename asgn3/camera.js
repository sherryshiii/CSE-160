class Camera {
    constructor(aspectRatio, near, far){
      this.fov = 60;
      this.eye = new Vector3([0, 0, 0]);
      this.at  = new Vector3([0, 0, -1]);
      this.up  = new Vector3([0, 1, 0]);

      this.speed = 0.2;
      this.alpha = 5; // degrees per pan

      this.viewMatrix = new Matrix4();
      this.viewMatrix.setLookAt(this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
                                this.at.elements[0],  this.at.elements[1],  this.at.elements[2],
                                this.up.elements[0],  this.up.elements[1],  this.up.elements[2]);

      this.projectionMatrix = new Matrix4();
      this.projectionMatrix.setPerspective(this.fov, aspectRatio, near, far);
    }

    moveForward(){
      // f = at - eye
      let f = new Vector3();
      f.set(this.at);
      f.sub(this.eye);
      f.normalize();
      f.mul(this.speed);
      // eye += f; at += f;
      this.eye.add(f);
      this.at.add(f);
      this.updateView();
    }

    moveBackwards(){
      // b = eye - at
      let b = new Vector3();
      b.set(this.eye);
      b.sub(this.at);
      b.normalize();
      b.mul(this.speed);
      this.eye.add(b);
      this.at.add(b);
      this.updateView();
    }

    moveLeft(){
      // f = at - eye
      let f = new Vector3();
      f.set(this.at);
      f.sub(this.eye);
      // s = up x f
      let s = Vector3.cross(this.up, f);
      s.normalize();
      s.mul(this.speed);
      this.eye.add(s);
      this.at.add(s);
      this.updateView();
    }

    moveRight(){
      // f = at - eye
      let f = new Vector3();
      f.set(this.at);
      f.sub(this.eye);
      // s = f x up
      let s = Vector3.cross(f, this.up);
      s.normalize();
      s.mul(this.speed);
      this.eye.add(s);
      this.at.add(s);
      this.updateView();
    }

    // rotate at around up by `angle` degrees (used by Q/E and the mouse)
    pan(angle){
      let f = new Vector3();
      f.set(this.at);
      f.sub(this.eye);
      let rotationMatrix = new Matrix4();
      rotationMatrix.setRotate(angle, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
      let f_prime = rotationMatrix.multiplyVector3(f);
      this.at.set(this.eye);
      this.at.add(f_prime);
      this.updateView();
    }

    panLeft(){
      this.pan(this.alpha);
    }

    panRight(){
      this.pan(-this.alpha);
    }

    // pitch up/down by rotating at around the side vector. clamped to +-85.
    tilt(angle){
      let f = new Vector3();
      f.set(this.at);
      f.sub(this.eye);

      // side = f x up
      let side = Vector3.cross(f, this.up);
      side.normalize();

      let rotationMatrix = new Matrix4();
      rotationMatrix.setRotate(angle, side.elements[0], side.elements[1], side.elements[2]);
      let f_prime = rotationMatrix.multiplyVector3(f);

      let horiz = Math.sqrt(
          f_prime.elements[0] * f_prime.elements[0] +
          f_prime.elements[2] * f_prime.elements[2]);
      let pitch = Math.atan2(f_prime.elements[1], horiz) * 180 / Math.PI;
      if (pitch > 85 || pitch < -85) return;

      this.at.set(this.eye);
      this.at.add(f_prime);
      this.updateView();
    }

    updateView(){
      this.viewMatrix.setLookAt(this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
                                this.at.elements[0],  this.at.elements[1],  this.at.elements[2],
                                this.up.elements[0],  this.up.elements[1],  this.up.elements[2]);
    }

}
