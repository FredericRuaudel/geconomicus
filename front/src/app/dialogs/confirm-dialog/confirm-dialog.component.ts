import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
  title = "Confirmer ?";
  message = "Etes vous sur ?";
  labelBtn1 = "Oui";
  labelBtn2 = "Annuler";
  autoClickBtn2 = false;
  timerBtn2: number = 5;


  constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.title = data.title ? data.title: this.title;
    this.message = data.message;
    this.labelBtn1 = data.labelBtn1;
    this.labelBtn2 = data.labelBtn2;
    this.autoClickBtn2 = data.autoClickBtn2;
    this.timerBtn2 = data.timerBtn2;
  }

  timerEnd(){
    this.dialogRef.close("btn2");
  }
}
