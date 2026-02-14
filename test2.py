import numpy as np

# Step 1: Construct integer L (lower triangular) and U (upper triangular)
L = np.array([
    [1, 0, 0, 0],
    [2, 1, 0, 0],
    [1, 3, 1, 0],
    [4, 2, 1, 1]
])

U = np.array([
    [3, 5, 2, 4],
    [0, 2, 3, 1],
    [0, 0, 1, 2],
    [0, 0, 0, 3]
])

# Step 2: Compute integer coefficient matrix A
A = L @ U

# Step 3: Choose integer solution vector
x_true = np.array([1, 2, 1, 1])

# Step 4: Compute RHS
b = A @ x_true

print("Coefficient matrix A:")
print(A)
print("\nRight-hand side b:")
print(b)

# Step 5: Doolittle LU decomposition manually
n = A.shape[0]
L_calc = np.eye(n, dtype=int)
U_calc = np.zeros((n, n), dtype=int)

for i in range(n):
    # Compute U row
    for j in range(i, n):
        sum_ = sum(L_calc[i,k]*U_calc[k,j] for k in range(i))
        U_calc[i,j] = A[i,j] - sum_
    # Compute L column
    for j in range(i+1, n):
        sum_ = sum(L_calc[j,k]*U_calc[k,i] for k in range(i))
        L_calc[j,i] = (A[j,i] - sum_) // U_calc[i,i]  # integer division

print("\nLower Triangular Matrix L:")
print(L_calc)

print("\nUpper Triangular Matrix U:")
print(U_calc)

# Step 6: Solve Ly = b
y = np.zeros(n, dtype=int)
for i in range(n):
    y[i] = b[i] - sum(L_calc[i,k]*y[k] for k in range(i))

# Step 7: Solve Ux = y
x_solved = np.zeros(n, dtype=int)
for i in reversed(range(n)):
    x_solved[i] = (y[i] - sum(U_calc[i,k]*x_solved[k] for k in range(i+1, n))) // U_calc[i,i]

print("\nSolution vector x:")
print(x_solved)

# Step 8: Verify Ax = b
Ax = A @ x_solved
print("\nVerification Ax = b:")
print(Ax)
