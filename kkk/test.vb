Option Strict On


Public Class form1
    Dim PiecesDone As Integer = 0
    Dim PricePerRange As Decimal = 0d
    Dim TotalPaid as Decimal  = 0d
    Dim TotalPiecesDone As Integer = 0
    Dim NumberOfEmployees as Integer =0


    Private Sub Calculate_click()
        if String.IsNullOrWhiteSpace(NameTextBox.Text) OrElse String.IsNullOrWhiteSpace(PiecesDoneTextBox.Text) Then 
            MessageBox.show("Fill the empty fields")
            Exit sub

        End if

        if Not Integer.TryParse(PiecesDoneTextBox.Text, PiecesDone) Then 
            MessageBox.Show("Enter a number")
            Exit sub
        End if

        if PiecesDone<=0 Then 
            MessageBox.Show("Enter a number greater than 0")
            Exit sub
        End if
        Try
            Select Case PiecesDone
                Case 1 To 200
                    PricePerRange = 80d
                Case 201 To 400
                    PricePerRange = 85d
                Case 401 To 600
                    PricePerRange = 90d
                Case is > 600
                    PricePerRange = 95d
            End Select

            Dim pay as Decimal  = 0d
            pay = PiecesDone* PricePerRange

            TotalPiecesDone+=PiecesDone
            TotalPaid +=pay
            NumberOfEmployees +=1

            PayTextBox.Text=pay.ToString("F2") 
            
        Catch ex As Exception
            MessageBox.show("Something went wrong" & ex)
        End Try
        


    End Sub

    Private Sub Summary_click()
        Try
            if NumberOfEmployees=0 Then 
                Throw New DivideByZeroException()
                Exit sub
            End if 
            
            Dim  Average As Decimal  = TotalPaid/NumberOfEmployees
            MessageBox.show("Total Pieces done: "& TotalPiecesDone.ToString()  & vbNewLine &
                            "Average pay per person: "& Average.ToString("F2") & vbNewLine &
                            "Total Paid: "& TotalPaid.ToString("F2") )

        Catch ex As Exception
            MessageBox.show("Something went wrong" & ex)
        End Try
        
    End Sub
    
    Private Sub Clear_click()
        NameTextBox.clear()
        PiecesDoneTextBox.clear()
        
    End Sub
    Private sub Close_click()
        Dim result As DialogResult

        result = MessageBox.show(
            "Are you sure you want to exit",
            "Confirm",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning
        )

        if result = DialogResult.Yes Then 
            Me.Close
        End If
    End sub
    
    Private Sub mnu_clear()
        Clear_Click()
    End Sub
    
    Private Sub mnu_Close()
        Close_click()
    End Sub

    Private Sub mnu_Calculate()
        Calculate_Click()
    End Sub
    
    Private Sub mnu_Summary()
        Summary_Click()
    End Sub
    
    
End Class
